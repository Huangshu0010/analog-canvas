import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = resolve(root, "packages/symbols/assets/razavi-v1");
const catalogPath = resolve(assetRoot, "catalog.json");
const evidencePaths = [
  resolve(root, "fixtures/symbols/vss-ir/razavi-rv1-master-ir.json"),
  resolve(
    root,
    "fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json",
  ),
];
const reviewManifestPath = resolve(
  root,
  "fixtures/symbols/circuit-vss-review.json",
);
const generatedPath = resolve(
  root,
  "packages/symbols/src/razavi-catalog.generated.ts",
);
const check = process.argv.includes("--check");
const generationPolicies = new Map([
  [
    "scripts/generate-visio-mos-assets.mjs",
    "fixtures/visual-reference/visio-mos/",
  ],
  [
    "scripts/generate-razavi-mos-assets.mjs",
    "fixtures/visual-reference/razavi-reference-v1/",
  ],
  [
    "scripts/generate-visio-core-analog-assets.mjs",
    "fixtures/visual-reference/visio-core-analog/",
  ],
]);

const normalize = (value) => `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function fail(message) {
  throw new Error(`Razavi catalog: ${message}`);
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const evidenceIrs = await Promise.all(
  evidencePaths.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);
const reviewManifest = JSON.parse(await readFile(reviewManifestPath, "utf8"));
if (
  catalog.schemaVersion !== 1 ||
  catalog.id !== "razavi-symbols" ||
  catalog.version !== 1
) {
  fail("unexpected catalog identity");
}
if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
  fail("catalog must contain entries");
}
for (const evidence of evidenceIrs) {
  if (
    evidence.decoder.id !== catalog.decoder.id ||
    evidence.decoder.version !== catalog.decoder.version
  ) {
    fail("catalog decoder identity does not match reviewed evidence");
  }
}
const evidenceMasters = new Set(
  evidenceIrs.flatMap((evidence) =>
    evidence.masters.map((master) => master.nameU),
  ),
);
const evidenceStencilHashes = new Set(
  evidenceIrs.map((evidence) => evidence.source.sha256),
);
const reviewedMappings = new Map(
  reviewManifest.mappings.map((mapping) => [mapping.symbolId, mapping]),
);
const provisionalMappings = new Map(
  reviewManifest.migrationCandidates.map((mapping) => [
    mapping.symbolId,
    mapping,
  ]),
);
if (!evidenceStencilHashes.has(reviewManifest.source.sha256)) {
  fail("review manifest stencil identity does not match decoder evidence");
}

const symbols = [];
const ids = new Set();
const aliases = new Set();
const masters = new Set();
const assetPaths = new Set();
for (const entry of catalog.entries) {
  if (ids.has(entry.symbolId) || aliases.has(entry.symbolId)) {
    fail(`duplicate symbol ID ${entry.symbolId}`);
  }
  ids.add(entry.symbolId);
  if (masters.has(entry.source.masterNameU)) {
    fail(`duplicate source Master ${entry.source.masterNameU}`);
  }
  masters.add(entry.source.masterNameU);
  if (
    entry.reviewStatus !== "reviewed" &&
    entry.reviewStatus !== "provisional"
  ) {
    fail(`invalid review status for ${entry.symbolId}`);
  }
  if (
    !entry.palette &&
    entry.automaticMappings.length === 0 &&
    !entry.manualOnlyReason
  ) {
    fail(`${entry.symbolId} is unreachable and lacks a manual-only reason`);
  }
  if (entry.reviewStatus === "reviewed") {
    const reviewedMapping = reviewedMappings.get(entry.symbolId);
    if (
      !reviewedMapping ||
      reviewedMapping.status !== "reviewed" ||
      reviewedMapping.masterNameU !== entry.source.masterNameU ||
      reviewedMapping.pins.join("\u0000") !== entry.pinOrder.join("\u0000")
    ) {
      fail(`review manifest mismatch for ${entry.symbolId}`);
    }
  } else {
    const provisionalMapping = provisionalMappings.get(entry.symbolId);
    if (
      !provisionalMapping ||
      provisionalMapping.masterNameU !== entry.source.masterNameU ||
      provisionalMapping.provisionalPins.join("\u0000") !==
        entry.pinOrder.join("\u0000")
    ) {
      fail(`provisional review manifest mismatch for ${entry.symbolId}`);
    }
  }
  if (
    !evidenceStencilHashes.has(entry.source.stencilHash) ||
    entry.source.decoderVersion !== catalog.decoder.version
  ) {
    fail(`invalid source provenance for ${entry.symbolId}`);
  }
  if (entry.generation !== undefined) {
    const referencePrefix = generationPolicies.get(
      entry.generation.converterPath,
    );
    if (!referencePrefix || entry.generation.converterVersion !== 1) {
      fail(`invalid generation provenance for ${entry.symbolId}`);
    }
    if (entry.generation.kind === "vss-master-ir") {
      if (
        !entry.generation.evidencePath?.startsWith("fixtures/symbols/vss-ir/") ||
        !entry.generation.referencePath.startsWith(referencePrefix)
      ) {
        fail(`invalid VSS generation provenance for ${entry.symbolId}`);
      }
      await readFile(resolve(root, entry.generation.evidencePath), "utf8");
    } else if (entry.generation.kind === "razavi-raster-reference") {
      if (
        !entry.generation.referenceManifestPath?.startsWith(referencePrefix) ||
        !entry.generation.referencePath.startsWith(referencePrefix)
      ) {
        fail(`invalid raster generation provenance for ${entry.symbolId}`);
      }
      const manifest = JSON.parse(
        await readFile(resolve(root, entry.generation.referenceManifestPath), "utf8"),
      );
      if (
        manifest.visualAuthority !== "sole" ||
        resolve(root, entry.generation.referencePath) !==
          resolve(dirname(resolve(root, entry.generation.referenceManifestPath)), manifest.assetPath)
      ) {
        fail(`invalid raster authority for ${entry.symbolId}`);
      }
    } else {
      fail(`unknown generation provenance for ${entry.symbolId}`);
    }
    await readFile(resolve(root, entry.generation.referencePath), "utf8");
    await readFile(resolve(root, entry.generation.converterPath), "utf8");
  }
  if (!evidenceMasters.has(entry.source.masterNameU)) {
    fail(`missing reviewed evidence for ${entry.source.masterNameU}`);
  }
  if (assetPaths.has(entry.assetPath)) {
    fail(`duplicate asset path ${entry.assetPath}`);
  }
  assetPaths.add(entry.assetPath);

  const assetPath = resolve(assetRoot, entry.assetPath);
  if (!assetPath.startsWith(`${assetRoot}${sep}`)) {
    fail(`asset path escapes catalog root: ${entry.assetPath}`);
  }
  const assetSource = normalize(await readFile(assetPath, "utf8"));
  const symbol = JSON.parse(assetSource);
  if (symbol.schemaVersion !== 1 || symbol.id !== entry.symbolId) {
    fail(`asset identity mismatch for ${entry.symbolId}`);
  }
  const pinOrder = symbol.pins.map((pin) => pin.name);
  if (pinOrder.join("\u0000") !== entry.pinOrder.join("\u0000")) {
    fail(`pin order mismatch for ${entry.symbolId}`);
  }
  for (const pin of symbol.pins) {
    if (pin.at.x % 10 !== 0 || pin.at.y % 10 !== 0) {
      fail(`off-grid pin ${entry.symbolId}.${pin.name}`);
    }
  }
  for (const alias of symbol.aliases) {
    if (ids.has(alias) || aliases.has(alias)) {
      fail(`duplicate symbol alias ${alias}`);
    }
    aliases.add(alias);
  }
  const assetHash = hash(assetSource);
  if (check && entry.assetHash !== assetHash) {
    fail(`asset hash mismatch for ${entry.symbolId}`);
  }
  entry.assetHash = assetHash;
  symbols.push(symbol);
}

const semanticIds = new Set();
for (const primitive of catalog.semanticPrimitives ?? []) {
  if (semanticIds.has(primitive.id)) {
    fail(`duplicate semantic primitive ${primitive.id}`);
  }
  semanticIds.add(primitive.id);
  if (primitive.disposition !== "semantic-primitive") {
    fail(`invalid semantic disposition for ${primitive.id}`);
  }
  if (
    !evidenceStencilHashes.has(primitive.source.stencilHash) ||
    primitive.source.decoderVersion !== catalog.decoder.version
  ) {
    fail(`invalid source provenance for ${primitive.id}`);
  }
  if (!evidenceMasters.has(primitive.source.masterNameU)) {
    fail(`missing reviewed evidence for ${primitive.source.masterNameU}`);
  }
  if (masters.has(primitive.source.masterNameU)) {
    fail(`source Master used twice: ${primitive.source.masterNameU}`);
  }
  masters.add(primitive.source.masterNameU);
}

const catalogSource = normalize(
  await format(JSON.stringify(catalog, null, 2), { parser: "json" }),
);
const generatedSource = normalize(
  await format(
    `
// Generated by scripts/generate-razavi-symbol-catalog.mjs. Do not edit.
import type { SymbolDefinition } from "./schema.js";
import type {
  RazaviSemanticPrimitiveEntry,
  RazaviSymbolCatalogEntry,
} from "./razavi-catalog.js";

export const razaviSymbolCatalogIdentity = ${JSON.stringify(
      {
        schemaVersion: catalog.schemaVersion,
        id: catalog.id,
        version: catalog.version,
        decoder: catalog.decoder,
      },
      null,
      2,
    )} as const;

export const razaviSymbolCatalogEntries: readonly RazaviSymbolCatalogEntry[] = ${JSON.stringify(
      catalog.entries,
      null,
      2,
    )};

export const razaviSemanticPrimitives: readonly RazaviSemanticPrimitiveEntry[] = ${JSON.stringify(
      catalog.semanticPrimitives ?? [],
      null,
      2,
    )};

export const razaviCatalogSymbols: readonly SymbolDefinition[] = ${JSON.stringify(
      symbols,
      null,
      2,
    )};
`,
    { parser: "typescript" },
  ),
);

if (check) {
  const checkedCatalog = normalize(await readFile(catalogPath, "utf8"));
  if (checkedCatalog !== catalogSource)
    fail("catalog formatting or hashes are stale");
  const checkedGenerated = normalize(await readFile(generatedPath, "utf8"));
  if (checkedGenerated !== generatedSource)
    fail("generated runtime adapter is stale");
  console.log(
    `Validated ${symbols.length} Razavi symbol assets and ${semanticIds.size} semantic primitive`,
  );
} else {
  await writeFile(catalogPath, catalogSource, "utf8");
  await writeFile(generatedPath, generatedSource, "utf8");
  console.log(
    `Generated ${symbols.length} Razavi symbol assets and ${semanticIds.size} semantic primitive`,
  );
}
