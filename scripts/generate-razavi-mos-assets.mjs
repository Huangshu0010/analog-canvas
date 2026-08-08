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
const check = process.argv.includes("--check");

// Final presentation coordinates. They are authored directly from the accepted
// 1204×794 Razavi raster; no VSS geometry, marker, or affine body transform is
// read by this generator. D/G/S/B anchors deliberately stay on the existing
// 10-unit electrical grid.
const body = {
  upperY: -8.13189,
  lowerY: 8.13189,
  gateInner: { left: -9.956614, right: -6.716614, top: -12.197835, bottom: 12.197835 },
  gateOuter: { left: -16.068819, right: -12.828819, top: -8.13189, bottom: 8.13189 },
  gateLeadFromX: -14.448819,
  channelX: 10,
  arrowLength: 8.13189,
  arrowHalfWidth: 3.77552,
  arrowSupportOverlap: 0.69,
};

const normal = { strokeRole: "normal", lineCap: "butt", lineJoin: "miter" };
const rounded = (value) => Math.round(value * 1_000_000) / 1_000_000;
const point = (x, y) => ({ x: rounded(x), y: rounded(y) });
const line = (from, to, part) => ({
  kind: "line",
  from,
  to,
  ...(part ? { part } : {}),
  style: normal,
});
const rectangle = (left, top, right, bottom, part) => ({
  kind: "polygon",
  points: [point(left, top), point(left, bottom), point(right, bottom), point(right, top)],
  fill: "foreground",
  stroke: "none",
  ...(part ? { part } : {}),
});
const triangle = (tip, firstBase, secondBase, part) => ({
  kind: "polygon",
  points: [tip, firstBase, secondBase],
  fill: "foreground",
  stroke: "none",
  ...(part ? { part } : {}),
});

const pins = (threeTerminal) => [
  {
    name: "D",
    role: "drain",
    at: point(10, -20),
    direction: "north",
    presentation: { visibility: "visible", leadLength: 10 },
  },
  {
    name: "G",
    role: "gate",
    at: point(-20, 0),
    direction: "west",
    presentation: { visibility: "visible", leadLength: 10 },
  },
  {
    name: "S",
    role: "source",
    at: point(10, 20),
    direction: "south",
    presentation: { visibility: "visible", leadLength: 10 },
  },
  ...(threeTerminal
    ? []
    : [
        {
          name: "B",
          role: "bulk",
          at: point(20, 0),
          direction: "east",
          presentation: { visibility: "visible", leadLength: 10 },
        },
      ]),
];

function sourceArrow(polarity) {
  const geometry =
    polarity === "nmos"
      ? {
          y: body.lowerY,
          tipX: body.channelX,
          baseX: body.channelX - body.arrowLength,
          supportFromX: body.gateInner.right,
          supportToX: body.channelX - body.arrowLength + body.arrowSupportOverlap,
        }
      : {
          y: body.upperY,
          tipX: -8.117731,
          baseX: -8.117731 + body.arrowLength,
          supportFromX: -0.675841,
          supportToX: body.channelX,
        };
  const tip = point(geometry.tipX, geometry.y);
  const base = point(geometry.baseX, geometry.y);
  return [
    line(point(geometry.supportFromX, geometry.y), point(geometry.supportToX, geometry.y), "source-arrow"),
    triangle(
      tip,
      point(base.x, base.y + body.arrowHalfWidth),
      point(base.x, base.y - body.arrowHalfWidth),
      "source-arrow",
    ),
  ];
}

function basePrimitives(polarity) {
  const sourceY = polarity === "nmos" ? body.lowerY : body.upperY;
  const otherY = polarity === "nmos" ? body.upperY : body.lowerY;
  const sourceHost = line(point(body.gateInner.right, sourceY), point(body.channelX, sourceY), "source-arrow-host");
  const ordinaryHost = line(point(body.gateInner.right, otherY), point(body.channelX, otherY));
  return [
    polarity === "nmos" ? ordinaryHost : sourceHost,
    polarity === "nmos" ? sourceHost : ordinaryHost,
    rectangle(body.gateInner.left, body.gateInner.top, body.gateInner.right, body.gateInner.bottom, "gate-bar"),
    rectangle(body.gateOuter.left, body.gateOuter.top, body.gateOuter.right, body.gateOuter.bottom, "gate-bar"),
    line(point(body.channelX, body.lowerY), point(body.channelX, 20)),
    line(point(body.gateLeadFromX, 0), point(-20, 0)),
    line(point(body.channelX, body.upperY), point(body.channelX, -20)),
  ];
}

function bulkPrimitives(polarity) {
  // Explicit bulk remains electrically visible only in the four-terminal view.
  // Its clean final coordinates are deliberately independent of VSS masters.
  if (polarity === "nmos") {
    return [
      line(point(2, 0), point(20, 0), "bulk-lead"),
      triangle(point(-6.13, 0), point(2.15, body.arrowHalfWidth), point(2.15, -body.arrowHalfWidth), "bulk-lead"),
    ];
  }
  return [
    line(point(-6.13, 0), point(12, 0), "bulk-lead"),
    triangle(point(20, 0), point(11.87, body.arrowHalfWidth), point(11.87, -body.arrowHalfWidth), "bulk-lead"),
  ];
}

function symbol(polarity, threeTerminal) {
  const id = `${polarity}${threeTerminal ? "3" : ""}`;
  const primitives = basePrimitives(polarity);
  if (!threeTerminal) primitives.push(...bulkPrimitives(polarity));
  else primitives.push(...sourceArrow(polarity));
  return {
    schemaVersion: 1,
    id,
    name: `${polarity === "nmos" ? "NMOS" : "PMOS"}${threeTerminal ? " (3-terminal)" : ""}`,
    viewBox: { x: -24, y: -24, width: 48, height: 48 },
    pins: pins(threeTerminal),
    primitives,
    variants: threeTerminal
      ? []
      : [
          {
            id: "textbook-3terminal",
            hiddenPinNames: ["B"],
            hiddenPrimitiveParts: ["bulk-lead", "source-arrow-host"],
            additionalPrimitives: sourceArrow(polarity),
          },
        ],
    aliases: [threeTerminal ? `mos-${polarity[0]}-3` : `mos-${polarity[0]}`],
  };
}

function fail(message) {
  throw new Error(`Razavi raster MOS generation: ${message}`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const referencePath = resolve(referenceRoot, manifest.assetPath);
const referenceHash = createHash("sha256")
  .update(await readFile(referencePath))
  .digest("hex");
if (manifest.visualAuthority !== "sole" || referenceHash !== manifest.sha256) {
  fail("the sole visual reference manifest does not match its raster");
}

for (const polarity of ["nmos", "pmos"]) {
  for (const threeTerminal of [false, true]) {
    const generated = await format(JSON.stringify(symbol(polarity, threeTerminal), null, 2), { parser: "json" });
    const target = resolve(assetRoot, `${polarity}${threeTerminal ? "3" : ""}.symbol.json`);
    if (!target.startsWith(`${assetRoot}${sep}`)) fail(`invalid output ${target}`);
    if (check) {
      const existing = await readFile(target, "utf8");
      if (existing.replaceAll("\r\n", "\n") !== generated) fail(`${relative(root, target)} is stale`);
    } else {
      await writeFile(target, generated, "utf8");
    }
  }
}

console.log(`${check ? "Validated" : "Generated"} 4 raster-authoritative Razavi MOS assets`);
