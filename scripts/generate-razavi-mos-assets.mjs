import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = resolve(root, "packages/symbols/assets/razavi-v1");
const referenceRoot = resolve(
  root,
  "fixtures/visual-reference/razavi-reference-v1",
);
const manifestPath = resolve(referenceRoot, "manifest.json");
const geometryPath = resolve(referenceRoot, "mos-geometry.json");
const check = process.argv.includes("--check");

const PIN_CONTRACT = [
  ["D", "drain", "north", { x: 10, y: -20 }],
  ["G", "gate", "west", { x: -20, y: 0 }],
  ["S", "source", "south", { x: 10, y: 20 }],
  ["B", "bulk", "east", { x: 20, y: 0 }],
];
const normal = { strokeRole: "normal", lineCap: "butt", lineJoin: "miter" };

function fail(message) {
  throw new Error(`Razavi raster MOS generation: ${message}`);
}

function rounded(value) {
  const result = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(result, -0) ? 0 : result;
}

function logicalPoint(measurement, pixelPoint) {
  return {
    x: rounded(
      (pixelPoint.x - measurement.originPx.x) / measurement.pixelsPerLogical,
    ),
    y: rounded(
      (pixelPoint.y - measurement.originPx.y) / measurement.pixelsPerLogical,
    ),
  };
}

function lineFromPixels(measurement, pixelSegment, part) {
  return {
    kind: "line",
    from: logicalPoint(measurement, pixelSegment.from),
    to: logicalPoint(measurement, pixelSegment.to),
    ...(part ? { part } : {}),
    style: normal,
  };
}

// Channel strokes meet separately rendered gate rectangles and D/S lead
// strokes. The measured channel endpoint and lead centre can differ by a raw
// pixel, so extending both ends creates a protrusion while leaving the join
// underconstrained. Use the D/S lead's own `from` point as the sole elbow
// centre. Only the gate-side endpoint overlaps its opaque bar.
function channelLineFromPixels(measurement, pixelSegment, part) {
  const elbow = [measurement.leadsPx.D, measurement.leadsPx.S].find(
    (lead) => lead.from.y === pixelSegment.to.y,
  )?.from;
  if (!elbow) {
    fail(
      `channel at y=${pixelSegment.to.y} has no D/S lead elbow in the pixel map`,
    );
  }
  return lineFromPixels(
    measurement,
    {
      from: { ...pixelSegment.from, x: pixelSegment.from.x - 1 },
      to: elbow,
    },
    part,
  );
}

function rectangleFromPixels(measurement, rectangle, part) {
  return {
    kind: "polygon",
    points: [
      logicalPoint(measurement, { x: rectangle.left, y: rectangle.top }),
      logicalPoint(measurement, { x: rectangle.left, y: rectangle.bottom }),
      logicalPoint(measurement, { x: rectangle.right, y: rectangle.bottom }),
      logicalPoint(measurement, { x: rectangle.right, y: rectangle.top }),
    ],
    fill: "foreground",
    stroke: "none",
    ...(part ? { part } : {}),
  };
}

function arrowFromPixels(measurement, arrow, part) {
  return [
    ...(arrow.supports ?? [arrow.support]).map((support) =>
      lineFromPixels(measurement, support, part),
    ),
    {
      kind: "polygon",
      points: [
        logicalPoint(measurement, arrow.tip),
        logicalPoint(measurement, arrow.baseTop),
        logicalPoint(measurement, arrow.baseBottom),
      ],
      fill: "foreground",
      stroke: "none",
      ...(part ? { part } : {}),
    },
  ];
}

function pins(measurement, threeTerminal) {
  return PIN_CONTRACT.filter(([name]) => !threeTerminal || name !== "B").map(
    ([name, role, direction, expected]) => {
      const actual = logicalPoint(measurement, measurement.pinsPx[name]);
      if (actual.x !== expected.x || actual.y !== expected.y) {
        fail(
          `${name} pixel anchor maps to ${actual.x},${actual.y}; expected ${expected.x},${expected.y}`,
        );
      }
      return {
        name,
        role,
        at: actual,
        direction,
        presentation: { visibility: "visible", leadLength: 10 },
      };
    },
  );
}

function basePrimitives(measurement, polarity) {
  const sourceChannel = polarity === "nmos" ? "lower" : "upper";
  const otherChannel = polarity === "nmos" ? "upper" : "lower";
  return [
    channelLineFromPixels(measurement, measurement.channelsPx[otherChannel]),
    channelLineFromPixels(
      measurement,
      measurement.channelsPx[sourceChannel],
      "source-arrow-host",
    ),
    ...measurement.gateBarsPx.map((rectangle) =>
      rectangleFromPixels(measurement, rectangle, "gate-bar"),
    ),
    lineFromPixels(measurement, measurement.leadsPx.S),
    lineFromPixels(measurement, measurement.leadsPx.G),
    lineFromPixels(measurement, measurement.leadsPx.D),
  ];
}

function primitivePoints(primitive) {
  if (primitive.kind === "line") return [primitive.from, primitive.to];
  if (primitive.kind === "polygon") return primitive.points;
  fail(`unsupported primitive ${primitive.kind}`);
}

function viewBoxFor(symbol) {
  const points = [
    ...symbol.pins.map((pin) => pin.at),
    ...symbol.primitives.flatMap(primitivePoints),
    ...symbol.variants.flatMap((variant) =>
      (variant.additionalPrimitives ?? []).flatMap(primitivePoints),
    ),
  ];
  const minimumX = Math.min(...points.map((point) => point.x)) - 4;
  const minimumY = Math.min(...points.map((point) => point.y)) - 4;
  const maximumX = Math.max(...points.map((point) => point.x)) + 4;
  const maximumY = Math.max(...points.map((point) => point.y)) + 4;
  // Symbol DSL viewBoxes are integer scene rectangles. Visual seam overlap
  // can introduce fractional pixel-mapped extrema, so expand outward rather
  // than rounding inward and risking a clipped stroke or invalid asset.
  const x = Math.floor(minimumX);
  const y = Math.floor(minimumY);
  const right = Math.ceil(maximumX);
  const bottom = Math.ceil(maximumY);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function symbol(polarity, measurement, threeTerminal) {
  const id = `${polarity}${threeTerminal ? "3" : ""}`;
  const primitives = basePrimitives(measurement, polarity);
  if (threeTerminal) {
    primitives.push(
      ...arrowFromPixels(
        measurement,
        measurement.sourceArrowPx,
        "source-arrow",
      ),
    );
  } else {
    primitives.push(
      ...arrowFromPixels(measurement, measurement.bulkExtensionPx, "bulk-lead"),
    );
  }
  const result = {
    schemaVersion: 1,
    id,
    name: `${polarity === "nmos" ? "NMOS" : "PMOS"}${threeTerminal ? " (3-terminal)" : ""}`,
    viewBox: { x: 0, y: 0, width: 1, height: 1 },
    pins: pins(measurement, threeTerminal),
    primitives,
    variants: threeTerminal
      ? []
      : [
          {
            id: "textbook-3terminal",
            hiddenPinNames: ["B"],
            hiddenPrimitiveParts: ["bulk-lead", "source-arrow-host"],
            additionalPrimitives: arrowFromPixels(
              measurement,
              measurement.sourceArrowPx,
              "source-arrow",
            ),
          },
        ],
    aliases: [threeTerminal ? `mos-${polarity[0]}-3` : `mos-${polarity[0]}`],
  };
  result.viewBox = viewBoxFor(result);
  return result;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const geometrySource = await readFile(geometryPath);
const geometry = JSON.parse(geometrySource.toString("utf8"));
const referencePath = resolve(referenceRoot, manifest.assetPath);
const referenceHash = createHash("sha256")
  .update(await readFile(referencePath))
  .digest("hex");
const geometryHash = createHash("sha256").update(geometrySource).digest("hex");
if (
  manifest.visualAuthority !== "sole" ||
  referenceHash !== manifest.sha256 ||
  geometry.referenceSha256 !== referenceHash ||
  geometry.referenceId !== manifest.id ||
  geometry.coordinateSystem !== "reference-raster-pixels" ||
  manifest.mosGeometryPath !== "mos-geometry.json" ||
  geometryHash !== manifest.mosGeometrySha256
) {
  fail("the complete MOS pixel map does not match the sole visual authority");
}

for (const polarity of ["nmos", "pmos"]) {
  const measurement = geometry.symbols?.[polarity];
  if (!measurement) fail(`missing complete pixel map for ${polarity}`);
  for (const threeTerminal of [false, true]) {
    const generated = await format(
      JSON.stringify(symbol(polarity, measurement, threeTerminal), null, 2),
      { parser: "json" },
    );
    const target = resolve(
      assetRoot,
      `${polarity}${threeTerminal ? "3" : ""}.symbol.json`,
    );
    if (!target.startsWith(`${assetRoot}${sep}`))
      fail(`invalid output ${target}`);
    if (check) {
      const existing = await readFile(target, "utf8");
      if (existing.replaceAll("\r\n", "\n") !== generated) {
        fail(`${relative(root, target)} is stale`);
      }
    } else {
      await writeFile(target, generated, "utf8");
    }
  }
}

console.log(
  `${check ? "Validated" : "Generated"} 4 complete pixel-mapped Razavi MOS assets`,
);
