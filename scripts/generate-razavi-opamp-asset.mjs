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
 * Figure 13.48 supplies the fully differential polarity layout and dual-output
 * topology. Its printed triangle is compact, whereas the product contract is
 * that FD Amp uses the same triangle body as the ordinary Razavi Op Amp
 * (Figure 8.26). Scale only the Figure 13.48 polarity layout into that shared
 * body; retain pin semantics and derive only marks needed for each state.
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

const opampTriangle = {
  leftX: -26.7979,
  apexX: 23.2021,
  topY: -24.9983,
  bottomY: 25,
};
const compactDifferentialTriangle = {
  leftX: -20,
  apexX: 14.9998,
  topY: -15.0002,
  bottomY: 14.9993,
};
const scaleDifferentialPoint = ({ x, y }) => ({
  x:
    opampTriangle.leftX +
    ((x - compactDifferentialTriangle.leftX) *
      (opampTriangle.apexX - opampTriangle.leftX)) /
      (compactDifferentialTriangle.apexX - compactDifferentialTriangle.leftX),
  y:
    opampTriangle.topY +
    ((y - compactDifferentialTriangle.topY) *
      (opampTriangle.bottomY - opampTriangle.topY)) /
      (compactDifferentialTriangle.bottomY - compactDifferentialTriangle.topY),
});
const scaleDifferentialLine = (geometry) => ({
  from: scaleDifferentialPoint(geometry.from),
  to: scaleDifferentialPoint(geometry.to),
});
const differentialLine = (geometry) => ({
  kind: "line",
  from: geometry.from,
  to: geometry.to,
  style: normal,
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
/** Keep the user-facing FD Amp leads compact without changing its core body. */
const FD_AMP_LEAD_SCALE = 0.5;
const CONNECTION_GRID = 10;
const snapToConnectionGrid = (value) =>
  Math.round(value / CONNECTION_GRID) * CONNECTION_GRID;
const halfwayAlongLead = (contact, pin) => ({
  ...pin,
  at: {
    x: snapToConnectionGrid(
      contact.x + (pin.at.x - contact.x) * FD_AMP_LEAD_SCALE,
    ),
    y: snapToConnectionGrid(
      contact.y + (pin.at.y - contact.y) * FD_AMP_LEAD_SCALE,
    ),
  },
});
const LEAD_JOIN_OVERLAP = 1.6;
const outputContact = (y) => {
  const reachesApexFromTop = y <= 0;
  const edgeY = reachesApexFromTop ? opampTriangle.topY : opampTriangle.bottomY;
  const ratio = reachesApexFromTop
    ? (y - edgeY) / (0 - edgeY)
    : (edgeY - y) / edgeY;
  return {
    x:
      opampTriangle.leftX + ratio * (opampTriangle.apexX - opampTriangle.leftX),
    y,
  };
};
const inputLeadContact = (y) => ({
  x: opampTriangle.leftX + LEAD_JOIN_OVERLAP,
  y,
});
const outputLeadContact = (y) => ({
  ...outputContact(y),
  x: outputContact(y).x - LEAD_JOIN_OVERLAP,
});
const inputLead = (pin, contact) => ({
  kind: "line",
  from: pin.at,
  to: contact,
  // Symbol DSL has no wire role; normal currently resolves to the Razavi wire
  // width (1.6 logical units) and tracks that profile value.
  style: normal,
});
const outputLead = (contact, pin) => ({
  kind: "line",
  from: contact,
  to: pin.at,
  style: normal,
});
const sourceInputMarks = [
  taggedLine(
    scaleDifferentialLine(differentialGeometry.input_plus_vertical),
    "input-polarity",
  ),
  taggedLine(
    scaleDifferentialLine(differentialGeometry.input_plus_horizontal),
    "input-polarity",
  ),
  taggedLine(
    scaleDifferentialLine(differentialGeometry.input_minus_horizontal),
    "input-polarity",
  ),
];
const sourceOutputMarks = [
  taggedLine(
    scaleDifferentialLine(differentialGeometry.output_minus_horizontal),
    "output-polarity",
  ),
  taggedLine(
    scaleDifferentialLine(differentialGeometry.output_plus_vertical),
    "output-polarity",
  ),
  taggedLine(
    scaleDifferentialLine(differentialGeometry.output_plus_horizontal),
    "output-polarity",
  ),
];
const differentialSymbol = (id, name, plusOutputAtBottom) => {
  const topInput = halfwayAlongLead(
    inputLeadContact(-OUTPUT_PAIR_OFFSET),
    symbol.pins[1],
  );
  const bottomInput = halfwayAlongLead(
    inputLeadContact(OUTPUT_PAIR_OFFSET),
    symbol.pins[0],
  );
  const topOutput = halfwayAlongLead(outputLeadContact(-OUTPUT_PAIR_OFFSET), {
    name: "OUT-",
    role: "output",
    at: { x: geometry.output.to.x, y: -OUTPUT_PAIR_OFFSET },
    direction: "east",
    presentation: { visibility: "visible", leadLength: 20 },
  });
  const bottomOutput = halfwayAlongLead(outputLeadContact(OUTPUT_PAIR_OFFSET), {
    name: "OUT+",
    role: "output",
    at: { x: geometry.output.to.x, y: OUTPUT_PAIR_OFFSET },
    direction: "east",
    presentation: { visibility: "visible", leadLength: 20 },
  });
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
      inputLead(topInput, inputLeadContact(-OUTPUT_PAIR_OFFSET)),
      inputLead(bottomInput, inputLeadContact(OUTPUT_PAIR_OFFSET)),
      outputLead(
        outputLeadContact(-OUTPUT_PAIR_OFFSET),
        outputPins.find((pin) => pin.at.y === -OUTPUT_PAIR_OFFSET),
      ),
      outputLead(
        outputLeadContact(OUTPUT_PAIR_OFFSET),
        outputPins.find((pin) => pin.at.y === OUTPUT_PAIR_OFFSET),
      ),
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
  converterVersion: 4,
};
const differentialAuthorityPaths = [
  "fixtures/visual-reference/razavi-reference-v1/opamp-vector-source.json",
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
