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
const assetRoot = resolve(root, "packages/symbols/assets/razavi-v1");
const catalogPath = resolve(assetRoot, "catalog.json");
const check = process.argv.includes("--check");
const normalize = (value) => `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

const entries = [
  ["diode", "Diode", "passive", ["A", "K"], ["spice:D"]],
  ["ideal-switch", "Ideal Switch", "switch", ["1", "2"], []],
  [
    "npn",
    "NPN Bipolar Transistor",
    "transistor",
    ["C", "B", "E"],
    ["spice:Q:npn", "pdk:model-type:npn"],
  ],
  [
    "pnp",
    "PNP Bipolar Transistor",
    "transistor",
    ["C", "B", "E"],
    ["spice:Q:pnp", "pdk:model-type:pnp"],
  ],
  [
    "transformer",
    "Transformer / Coupled Inductor",
    "passive",
    ["P1", "P2", "S1", "S2"],
    [],
  ],
  [
    "vccs",
    "Voltage-Controlled Current Source",
    "source",
    ["OUT+", "OUT-", "CTRL+", "CTRL-"],
    ["spice:G"],
  ],
  ["voltage-amplifier", "Voltage Amplifier", "analog-block", ["IN", "OUT"], []],
];

function fail(message) {
  throw new Error(`Razavi common asset generation: ${message}`);
}

const { manifest, files } = await loadRazaviReferenceAuthority(referenceRoot);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
for (const [symbolId, name, category, pinOrder, automaticMappings] of entries) {
  const authorityId = `razavi-textbook-${symbolId}`;
  const authority = manifest.vectorEvidence?.find(
    (candidate) => candidate.id === authorityId,
  );
  if (!authority || authority.kind !== "pdf-vector-extract")
    fail(`missing authority ${authorityId}`);
  const evidenceSource = files.get(authority.extractPath);
  if (!evidenceSource) fail(`missing loaded evidence ${authorityId}`);
  const evidence = JSON.parse(evidenceSource.toString("utf8"));
  const symbol = evidence.normalization?.symbolDefinition;
  if (
    evidence.id !== authorityId ||
    symbol?.id !== symbolId ||
    symbol.pins?.map((pin) => pin.name).join("\0") !== pinOrder.join("\0")
  ) {
    fail(`evidence contract mismatch for ${symbolId}`);
  }
  const assetPath = resolve(assetRoot, `${symbolId}.symbol.json`);
  const assetSource = normalize(
    await format(JSON.stringify(symbol, null, 2), { parser: "json" }),
  );
  const entry = catalog.entries.find(
    (candidate) => candidate.symbolId === symbolId,
  );
  const nextEntry = {
    symbolId,
    name,
    category,
    reviewStatus: "reviewed",
    pinOrder,
    palette: true,
    automaticMappings,
    ...(automaticMappings.length === 0
      ? {
          manualOnlyReason:
            symbolId === "ideal-switch"
              ? "Two-terminal Razavi switch; SPICE S has a four-terminal control contract."
              : symbolId === "transformer"
                ? "Textbook four-terminal visual composite; SPICE K references existing inductors rather than owning four nodes."
                : "Textbook gain block has implicit reference nodes and no exact primitive SPICE terminal contract.",
        }
      : {}),
    assetPath: `${symbolId}.symbol.json`,
    assetHash: hash(assetSource),
    visualAuthority: {
      kind: "razavi-reference-v1",
      referenceManifestPath:
        "fixtures/visual-reference/razavi-reference-v1/manifest.json",
      referencePaths: [
        `fixtures/visual-reference/razavi-reference-v1/${symbolId}-vector-source.json`,
        `fixtures/visual-reference/razavi-reference-v1/${symbolId}-reference.png`,
      ],
      calibrationPath:
        "fixtures/visual-reference/razavi-reference-v1/common-symbol-geometry.json",
    },
    generation: {
      kind: "razavi-pdf-vector-reference",
      referenceManifestPath:
        "fixtures/visual-reference/razavi-reference-v1/manifest.json",
      referencePath: `fixtures/visual-reference/razavi-reference-v1/${symbolId}-vector-source.json`,
      converterPath: "scripts/generate-razavi-common-assets.mjs",
      converterVersion: 1,
    },
  };
  if (entry) Object.assign(entry, nextEntry);
  else catalog.entries.push(nextEntry);
  if (check) {
    if (normalize(await readFile(assetPath, "utf8")) !== assetSource)
      fail(`${relative(root, assetPath)} is stale`);
  } else {
    await writeFile(assetPath, assetSource, "utf8");
  }
}
catalog.entries.sort((left, right) =>
  left.symbolId.localeCompare(right.symbolId),
);
const catalogSource = normalize(
  await format(JSON.stringify(catalog, null, 2), { parser: "json" }),
);
if (check) {
  if (normalize(await readFile(catalogPath, "utf8")) !== catalogSource)
    fail(`${relative(root, catalogPath)} is stale`);
} else {
  await writeFile(catalogPath, catalogSource, "utf8");
}
console.log(
  `${check ? "Validated" : "Generated"} ${entries.length} common Razavi assets`,
);
