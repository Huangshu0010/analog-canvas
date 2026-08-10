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
  aliases: ["op-amp", "operational-amplifier"],
};
const assetSource = normalize(
  await format(JSON.stringify(symbol, null, 2), { parser: "json" }),
);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const entry = catalog.entries.find(
  (candidate) => candidate.symbolId === symbol.id,
);
if (!entry) fail("missing catalog entry opamp");
entry.assetHash = hash(assetSource);
entry.generation = {
  kind: "razavi-pdf-vector-reference",
  referenceManifestPath:
    "fixtures/visual-reference/razavi-reference-v1/manifest.json",
  referencePath:
    "fixtures/visual-reference/razavi-reference-v1/opamp-vector-source.json",
  converterPath: "scripts/generate-razavi-opamp-asset.mjs",
  converterVersion: 1,
};
const catalogSource = normalize(
  await format(JSON.stringify(catalog, null, 2), { parser: "json" }),
);

if (check) {
  if (normalize(await readFile(assetPath, "utf8")) !== assetSource) {
    fail(`${relative(root, assetPath)} is stale`);
  }
  if (normalize(await readFile(catalogPath, "utf8")) !== catalogSource) {
    fail(`${relative(root, catalogPath)} is stale`);
  }
} else {
  await writeFile(assetPath, assetSource, "utf8");
  await writeFile(catalogPath, catalogSource, "utf8");
}

console.log(
  `${check ? "Validated" : "Generated"} PDF-derived Razavi op-amp asset`,
);
