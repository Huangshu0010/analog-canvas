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
 * Figure 13.48 is the direct source for the fully differential body.  It is a
 * compact native triangle: its two outputs leave the sloping edges, rather
 * than a synthetic truncation of Figure 8.26's apex.  The source's displayed
 * input polarity is the input-swapped state of our persistent FD Amp contract;
 * retain the pin semantics and derive only the marks needed for each state.
 */
const differentialAuthority = manifest.vectorEvidence?.find(
  (candidate) =>
    candidate.id === "razavi-textbook-figure-13-48-differential-opamp",
);
if (
  !differentialAuthority ||
  differentialAuthority.kind !== "pdf-vector-extract"
) {
  fail("missing manifest-pinned Figure 13.48 differential op-amp evidence");
}
const differentialEvidenceSource = files.get(differentialAuthority.extractPath);
if (!differentialEvidenceSource) {
  fail("Figure 13.48 vector evidence was not loaded by the authority");
}
const differentialEvidence = JSON.parse(
  differentialEvidenceSource.toString("utf8"),
);
const differentialGeometry = differentialEvidence.normalization?.symbolGeometry;
if (
  differentialEvidence.schemaVersion !== 1 ||
  differentialEvidence.id !== differentialAuthority.id ||
  differentialEvidence.source?.sha256 !== differentialAuthority.source.sha256 ||
  differentialEvidence.source?.pdfPage !==
    differentialAuthority.source.pdfPage ||
  differentialEvidence.normalization?.pinAnchorsLogical?.length !== 4 ||
  differentialEvidence.normalization?.derivation?.kind !==
    "semantic-pin-extension" ||
  typeof differentialGeometry?.trianglePathData !== "string"
) {
  fail("Figure 13.48 differential op-amp evidence contract mismatch");
}

const differentialNormal = {
  strokeWidth: Number(
    (
      differentialEvidence.selection.normalLineWidthPdfPt *
      differentialEvidence.normalization.logicalUnitsPerPdfPoint
    ).toFixed(6),
  ),
  lineCap: "butt",
  lineJoin: "miter",
};
const differentialTriangle = {
  strokeWidth: Number(
    (
      differentialEvidence.selection.triangleLineWidthPdfPt *
      differentialEvidence.normalization.logicalUnitsPerPdfPoint
    ).toFixed(6),
  ),
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 4,
};
const differentialLine = (geometry) => ({
  kind: "line",
  from: geometry.from,
  to: geometry.to,
  style: differentialNormal,
});
const taggedLine = (geometry, part) => ({
  ...differentialLine(geometry),
  part,
});
const acrossAxis = (primitive) => ({
  ...primitive,
  from: { ...primitive.from, y: -primitive.from.y },
  to: { ...primitive.to, y: -primitive.to.y },
});
const inputLead = (pin, sourceLead) => ({
  kind: "line",
  from: pin.at,
  to: sourceLead.to,
  style: differentialNormal,
});
const outputLead = (sourceLead, pin) => ({
  kind: "line",
  from: sourceLead.from,
  to: pin.at,
  style: differentialNormal,
});
const sourceInputMarks = [
  taggedLine(differentialGeometry.input_plus_vertical, "input-polarity"),
  taggedLine(differentialGeometry.input_plus_horizontal, "input-polarity"),
  taggedLine(differentialGeometry.input_minus_horizontal, "input-polarity"),
];
const sourceOutputMarks = [
  taggedLine(differentialGeometry.output_minus_horizontal, "output-polarity"),
  taggedLine(differentialGeometry.output_plus_vertical, "output-polarity"),
  taggedLine(differentialGeometry.output_plus_horizontal, "output-polarity"),
];
const differentialSymbol = (id, name, plusOutputAtBottom) => {
  const topInput = symbol.pins[1];
  const bottomInput = symbol.pins[0];
  const topOutput = {
    name: "OUT-",
    role: "output",
    at: { x: geometry.output.to.x, y: -OUTPUT_PAIR_OFFSET },
    direction: "east",
    presentation: { visibility: "visible", leadLength: 20 },
  };
  const bottomOutput = {
    name: "OUT+",
    role: "output",
    at: { x: geometry.output.to.x, y: OUTPUT_PAIR_OFFSET },
    direction: "east",
    presentation: { visibility: "visible", leadLength: 20 },
  };
  const outputPins = plusOutputAtBottom
    ? [bottomOutput, topOutput]
    : [
        { ...topOutput, name: "OUT+" },
        { ...bottomOutput, name: "OUT-" },
      ];
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: symbol.viewBox,
    pins: [bottomInput, topInput, ...outputPins],
    primitives: [
      inputLead(topInput, differentialGeometry.input_plus),
      inputLead(bottomInput, differentialGeometry.input_minus),
      outputLead(
        differentialGeometry.output_minus,
        outputPins.find((pin) => pin.at.y === -OUTPUT_PAIR_OFFSET),
      ),
      outputLead(
        differentialGeometry.output_plus,
        outputPins.find((pin) => pin.at.y === OUTPUT_PAIR_OFFSET),
      ),
      {
        kind: "path",
        data: differentialGeometry.trianglePathData,
        style: differentialTriangle,
      },
      ...sourceInputMarks.map(acrossAxis),
      ...(plusOutputAtBottom
        ? sourceOutputMarks
        : sourceOutputMarks.map(acrossAxis)),
    ],
    variants: [],
  };
};
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
const differentialGeneration = {
  kind: "razavi-pdf-vector-reference",
  referenceManifestPath:
    "fixtures/visual-reference/razavi-reference-v1/manifest.json",
  referencePath:
    "fixtures/visual-reference/razavi-reference-v1/differential-opamp-vector-source.json",
  converterPath: "scripts/generate-razavi-opamp-asset.mjs",
  converterVersion: 3,
};
const differentialAuthorityPaths = [
  "fixtures/visual-reference/razavi-reference-v1/differential-opamp-vector-source.json",
  "fixtures/visual-reference/razavi-reference-v1/differential-opamp-reference.png",
];
const baseEntry = catalog.entries.find(
  (candidate) => candidate.symbolId === symbol.id,
);
if (!baseEntry) fail(`missing catalog entry ${symbol.id}`);
baseEntry.assetHash = hash(assetSource);
baseEntry.generation = { ...generation };
for (const [id, source] of differentialSources) {
  const entry = catalog.entries.find((candidate) => candidate.symbolId === id);
  if (!entry) fail(`missing catalog entry ${id}`);
  entry.assetHash = hash(source);
  entry.visualAuthority = {
    ...entry.visualAuthority,
    referencePaths: differentialAuthorityPaths,
    calibrationPath:
      "fixtures/visual-reference/razavi-reference-v1/differential-opamp-geometry.json",
  };
  entry.generation = { ...differentialGeneration };
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
    " (Figure 13.48 differential body)",
);
