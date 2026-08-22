import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import { loadRazaviReferenceAuthority } from "./lib/razavi-reference-authority.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = resolve(
  root,
  "fixtures/visual-reference/razavi-reference-v1",
);
const assetPath = resolve(
  root,
  "packages/symbols/assets/razavi-v1/opamp.symbol.json",
);
const differentialAssetPaths = {
  "opamp-differential": resolve(
    root,
    "packages/symbols/assets/razavi-v1/opamp-differential.symbol.json",
  ),
  "opamp-differential-crossed": resolve(
    root,
    "packages/symbols/assets/razavi-v1/opamp-differential-crossed.symbol.json",
  ),
};
/** Output pair height; the reviewed input pair uses the same ±10 offset. */
const OUTPUT_PAIR_OFFSET = 10;
const catalogPath = resolve(
  root,
  "packages/symbols/assets/razavi-v1/catalog.json",
);
const check = process.argv.includes("--check");
const normalize = (value) => `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normal = { strokeRole: "normal", lineCap: "butt", lineJoin: "miter" };

function fail(message) {
  throw new Error(`Razavi op-amp generation: ${message}`);
}

function line(geometry) {
  return { kind: "line", from: geometry.from, to: geometry.to, style: normal };
}

const { manifest, files } = await loadRazaviReferenceAuthority(referenceRoot);
const authority = manifest.vectorEvidence?.find(
  (candidate) => candidate.id === "razavi-textbook-figure-8-26-opamp",
);
if (!authority || authority.kind !== "pdf-vector-extract") {
  fail("missing manifest-pinned PDF vector evidence");
}
const evidenceSource = files.get(authority.extractPath);
if (!evidenceSource) fail("vector evidence was not loaded by the authority");
const evidence = JSON.parse(evidenceSource.toString("utf8"));
const geometry = evidence.normalization?.symbolGeometry;
if (
  evidence.schemaVersion !== 1 ||
  evidence.id !== authority.id ||
  evidence.kind !== authority.kind ||
  evidence.source.sha256 !== authority.source.sha256 ||
  evidence.source.pdfPage !== authority.source.pdfPage ||
  evidence.normalization.pinAnchorsLogical?.length !== 3 ||
  evidence.normalization.strokeMapping?.normal?.targetRole !== "normal" ||
  evidence.normalization.strokeMapping?.triangle?.targetRole !== "emphasis" ||
  typeof geometry?.trianglePathData !== "string"
) {
  fail("vector evidence contract mismatch");
}

const symbol = {
  schemaVersion: 1,
  id: "opamp",
  name: "Operational Amplifier",
  viewBox: { x: -54, y: -28, width: 98, height: 56 },
  pins: [
    {
      name: "IN+",
      role: "non-inverting-input",
      at: { x: -50, y: 10 },
      direction: "west",
      presentation: { visibility: "visible", leadLength: 20 },
    },
    {
      name: "IN-",
      role: "inverting-input",
      at: { x: -50, y: -10 },
      direction: "west",
      presentation: { visibility: "visible", leadLength: 20 },
    },
    {
      name: "OUT",
      role: "output",
      at: { x: 40, y: 0 },
      direction: "east",
      presentation: { visibility: "visible", leadLength: 20 },
    },
  ],
  primitives: [
    line(geometry.inputMinus),
    line(geometry.inputPlus),
    line(geometry.output),
    {
      kind: "path",
      data: geometry.trianglePathData,
      style: {
        strokeRole: "emphasis",
        lineCap: "butt",
        lineJoin: "miter",
        miterLimit: 4,
      },
    },
    line(geometry.plusVertical),
    line(geometry.plusHorizontal),
    line(geometry.minusHorizontal),
  ],
  variants: [],
};
const assetSource = normalize(
  await format(JSON.stringify(symbol, null, 2), { parser: "json" }),
);

/**
 * The fully differential amplifier is the same reviewed body with its apex
 * truncated at the height of the output pair, so two outputs can leave a real
 * edge instead of a point. Every number below is derived from the pinned
 * evidence: the cut lands where the reviewed triangle edges reach ±10, and the
 * output polarity marks are the reviewed input marks reflected about the
 * body's own vertical centerline.
 */
const trianglePoints = [
  ...geometry.trianglePathData.matchAll(
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gu,
  ),
].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
if (trianglePoints.length !== 3) fail("triangle evidence is not a triangle");
const apex = trianglePoints.reduce((best, point) =>
  point.x > best.x ? point : best,
);
const backEdgeX = Math.min(...trianglePoints.map((point) => point.x));
const backTop = Math.min(...trianglePoints.map((point) => point.y));
const backBottom = Math.max(...trianglePoints.map((point) => point.y));
const round = (value) => Number(value.toFixed(4));
/** Where a reviewed triangle edge crosses the given height. */
const edgeXAtHeight = (backY, height) =>
  backEdgeX + ((backY - height) / (backY - apex.y)) * (apex.x - backEdgeX);
const cutTopX = edgeXAtHeight(backTop, -OUTPUT_PAIR_OFFSET);
const cutBottomX = edgeXAtHeight(backBottom, OUTPUT_PAIR_OFFSET);
if (Math.abs(cutTopX - cutBottomX) > 0.05) {
  fail("reviewed triangle is not symmetric about its output axis");
}
const cutX = round((cutTopX + cutBottomX) / 2);
const centerlineX = (backEdgeX + apex.x) / 2;
const reflect = (point) => ({
  x: round(2 * centerlineX - point.x),
  y: point.y,
});
const reflectLine = ({ from, to }) => ({
  from: reflect(from),
  to: reflect(to),
});
const outputLead = (y) => ({
  kind: "line",
  from: { x: cutX, y },
  to: { x: geometry.output.to.x, y },
  style: normal,
});
const outputPlusMarks = [
  line(reflectLine(geometry.plusVertical)),
  line(reflectLine(geometry.plusHorizontal)),
];
const outputMinusMark = line(reflectLine(geometry.minusHorizontal));
/** Mirror a mark to the opposite output rail. */
const acrossAxis = (primitive) => ({
  ...primitive,
  from: { ...primitive.from, y: -primitive.from.y },
  to: { ...primitive.to, y: -primitive.to.y },
});
const differentialSymbol = (id, name, plusOutputAtBottom) => ({
  schemaVersion: 1,
  id,
  name,
  viewBox: symbol.viewBox,
  pins: [
    symbol.pins[0],
    symbol.pins[1],
    {
      name: "OUT+",
      role: "output",
      at: {
        x: geometry.output.to.x,
        y: plusOutputAtBottom ? OUTPUT_PAIR_OFFSET : -OUTPUT_PAIR_OFFSET,
      },
      direction: "east",
      presentation: { visibility: "visible", leadLength: 20 },
    },
    {
      name: "OUT-",
      role: "output",
      at: {
        x: geometry.output.to.x,
        y: plusOutputAtBottom ? -OUTPUT_PAIR_OFFSET : OUTPUT_PAIR_OFFSET,
      },
      direction: "east",
      presentation: { visibility: "visible", leadLength: 20 },
    },
  ],
  primitives: [
    line(geometry.inputMinus),
    line(geometry.inputPlus),
    outputLead(-OUTPUT_PAIR_OFFSET),
    outputLead(OUTPUT_PAIR_OFFSET),
    {
      kind: "path",
      data: `M ${round(backEdgeX)} ${round(backTop)} L ${round(backEdgeX)} ${round(backBottom)} L ${cutX} ${OUTPUT_PAIR_OFFSET} L ${cutX} ${-OUTPUT_PAIR_OFFSET} Z`,
      style: {
        strokeRole: "emphasis",
        lineCap: "butt",
        lineJoin: "miter",
        miterLimit: 4,
      },
    },
    line(geometry.plusVertical),
    line(geometry.plusHorizontal),
    line(geometry.minusHorizontal),
    ...(plusOutputAtBottom
      ? [...outputPlusMarks, outputMinusMark]
      : [...outputPlusMarks.map(acrossAxis), acrossAxis(outputMinusMark)]),
  ],
  variants: [],
});
const differentialSymbols = [
  differentialSymbol("opamp-differential", "Differential Op Amp", true),
  differentialSymbol(
    "opamp-differential-crossed",
    "Differential Op Amp (crossed outputs)",
    false,
  ),
];
const differentialSources = new Map(
  await Promise.all(
    differentialSymbols.map(async (candidate) => [
      candidate.id,
      normalize(
        await format(JSON.stringify(candidate, null, 2), { parser: "json" }),
      ),
    ]),
  ),
);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const generation = {
  kind: "razavi-pdf-vector-reference",
  referenceManifestPath:
    "fixtures/visual-reference/razavi-reference-v1/manifest.json",
  referencePath:
    "fixtures/visual-reference/razavi-reference-v1/opamp-vector-source.json",
  converterPath: "scripts/generate-razavi-opamp-asset.mjs",
  converterVersion: 2,
};
for (const [id, source] of [[symbol.id, assetSource], ...differentialSources]) {
  const entry = catalog.entries.find((candidate) => candidate.symbolId === id);
  if (!entry) fail(`missing catalog entry ${id}`);
  entry.assetHash = hash(source);
  entry.generation = { ...generation };
}
const catalogSource = normalize(
  await format(JSON.stringify(catalog, null, 2), { parser: "json" }),
);

const outputs = [
  [assetPath, assetSource],
  ...differentialSymbols.map((candidate) => [
    differentialAssetPaths[candidate.id],
    differentialSources.get(candidate.id),
  ]),
  [catalogPath, catalogSource],
];
if (check) {
  for (const [path, source] of outputs) {
    if (normalize(await readFile(path, "utf8")) !== source) {
      fail(`${relative(root, path)} is stale`);
    }
  }
} else {
  for (const [path, source] of outputs) {
    await writeFile(path, source, "utf8");
  }
}

console.log(
  `${check ? "Validated" : "Generated"} PDF-derived Razavi op-amp assets` +
    ` (differential body cut at x=${cutX})`,
);
