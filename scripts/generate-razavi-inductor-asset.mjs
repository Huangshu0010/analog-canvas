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
  "packages/symbols/assets/razavi-v1/inductor.symbol.json",
);
const catalogPath = resolve(
  root,
  "packages/symbols/assets/razavi-v1/catalog.json",
);
const check = process.argv.includes("--check");
const normalize = (value) => `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function fail(message) {
  throw new Error(`Razavi inductor generation: ${message}`);
}

const { manifest, files } = await loadRazaviReferenceAuthority(referenceRoot);
const authority = manifest.vectorEvidence?.find(
  (candidate) => candidate.id === "razavi-textbook-figure-15-21-inductor",
);
if (!authority || authority.kind !== "pdf-vector-extract") {
  fail("missing manifest-pinned PDF vector evidence");
}
const evidenceSource = files.get(authority.extractPath);
if (!evidenceSource) fail("vector evidence was not loaded by the authority");
const evidence = JSON.parse(evidenceSource.toString("utf8"));
if (
  evidence.schemaVersion !== 1 ||
  evidence.id !== authority.id ||
  evidence.kind !== authority.kind ||
  evidence.source.sha256 !== authority.source.sha256 ||
  evidence.source.pdfPage !== authority.source.pdfPage ||
  evidence.normalization.targetLineWidthLogical !== 1.6 ||
  evidence.normalization.pinAnchorsLogical?.length !== 2 ||
  typeof evidence.normalization.symbolPathData !== "string"
) {
  fail("vector evidence contract mismatch");
}

const symbol = {
  schemaVersion: 1,
  id: "inductor",
  name: "Inductor",
  viewBox: { x: -15, y: -32, width: 30, height: 64 },
  pins: [
    {
      name: "1",
      role: "passive",
      at: { x: 0, y: -30 },
      direction: "north",
      presentation: { visibility: "visible", leadLength: 10 },
    },
    {
      name: "2",
      role: "passive",
      at: { x: 0, y: 30 },
      direction: "south",
      presentation: { visibility: "visible", leadLength: 10 },
    },
  ],
  primitives: [
    {
      kind: "path",
      data: evidence.normalization.symbolPathData,
      style: {
        strokeRole: "normal",
        lineCap: "butt",
        lineJoin: "round",
      },
    },
  ],
  variants: [],
};
const assetSource = normalize(
  await format(JSON.stringify(symbol, null, 2), { parser: "json" }),
);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const entry = catalog.entries.find(
  (candidate) => candidate.symbolId === symbol.id,
);
if (!entry) fail("missing catalog entry inductor");
entry.assetHash = hash(assetSource);
entry.generation = {
  kind: "razavi-pdf-vector-reference",
  referenceManifestPath:
    "fixtures/visual-reference/razavi-reference-v1/manifest.json",
  referencePath:
    "fixtures/visual-reference/razavi-reference-v1/inductor-vector-source.json",
  converterPath: "scripts/generate-razavi-inductor-asset.mjs",
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
  `${check ? "Validated" : "Generated"} PDF-derived Razavi inductor asset`,
);
