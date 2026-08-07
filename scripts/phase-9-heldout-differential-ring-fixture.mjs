import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildAgentSessionSnapshot } from "../packages/agent-adapter/dist/index.js";
import { serializeProject } from "../packages/model/dist/index.js";
import { importSpiceSources } from "../packages/spice/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../packages/symbols/dist/index.js";

const check = process.argv.includes("--check");
const sourcePath = resolve(
  "netlists/phase-9-heldout-differential-ring-8stage/circuit.spi",
);
const projectPath = resolve(
  "fixtures/agent-layout-eval/heldout-differential-ring-8stage-start.icproj.json",
);
const reportPath = resolve(
  "fixtures/agent-layout-eval/heldout-differential-ring-8stage-import-report.json",
);

const imported = await importSpiceSources(
  [{ path: "circuit.spi", bytes: await readFile(sourcePath) }],
  "circuit.spi",
);
if (!imported.successful || !imported.project)
  throw new Error(
    `Held-out differential ring import failed: ${imported.diagnostics
      .map((item) => `${item.code}: ${item.message}`)
      .join("; ")}`,
  );
const project = imported.project;
const top = project.documents.find(
  (item) => item.name === "differential_ring_8stage",
);
const cell = project.documents.find(
  (item) => item.name === "differential_delay_cell",
);
if (!top || !cell || project.topDocumentId !== top.id)
  throw new Error("Held-out differential ring hierarchy is incorrect");
const references = top.instances.filter(
  (instance) =>
    instance.properties["spice.target"] ===
    "subcircuit:differential_delay_cell",
);
const genericInstances = project.documents.flatMap((document) =>
  document.instances.filter((instance) =>
    instance.symbolId.startsWith("generic-block-"),
  ),
);
const resolver = createProjectSymbolResolver(project, builtInSymbols);
const snapshots = project.documents.map((document) =>
  buildAgentSessionSnapshot({ project, document, resolver }),
);
const assertions = {
  documentCount: project.documents.length === 2,
  topInstances: top.instances.length === 8,
  cellInstances: cell.instances.length === 14,
  cellReferences: references.length === 8,
  topPorts: top.ports.length === 6,
  cellPorts: cell.ports.length === 8,
  topNets: top.nets.length === 20,
  cellNets: cell.nets.length === 11,
  genericInstances: genericInstances.length === 0,
  elaboratedMosCount: references.length * cell.instances.length === 112,
  importErrors:
    imported.diagnostics.filter((item) => item.severity === "error").length ===
    0,
};
if (!Object.values(assertions).every(Boolean))
  throw new Error(
    `Held-out differential ring assertions failed: ${JSON.stringify(assertions)}`,
  );

const report = {
  version: "1.0",
  status: "held-out-after-run-2-remediation-freeze",
  source: "netlists/phase-9-heldout-differential-ring-8stage/circuit.spi",
  topologyOnly: true,
  simulated: false,
  documents: snapshots.map((snapshot) => ({
    id: snapshot.document.id,
    name: snapshot.document.name,
    instances: snapshot.document.instances.length,
    nets: snapshot.document.nets.length,
    ports: snapshot.document.ports.length,
    snapshotBytes: snapshot.byteLength,
    topologyHash: snapshot.topologyHash,
  })),
  cellReferences: references.length,
  elaboratedMosCount: references.length * cell.instances.length,
  importDiagnostics: Object.fromEntries(
    [...new Set(imported.diagnostics.map((item) => item.code))]
      .sort()
      .map((code) => [
        code,
        imported.diagnostics.filter((item) => item.code === code).length,
      ]),
  ),
  assertions,
  passed: true,
};
const projectText = serializeProject(project);
const reportText = `${JSON.stringify(report, null, 2)}\n`;
if (check) {
  if ((await readFile(projectPath, "utf8")) !== projectText)
    throw new Error("Held-out differential ring starting Project is stale");
  if ((await readFile(reportPath, "utf8")) !== reportText)
    throw new Error("Held-out differential ring import report is stale");
} else {
  await writeFile(projectPath, projectText);
  await writeFile(reportPath, reportText);
}
process.stdout.write(reportText);
