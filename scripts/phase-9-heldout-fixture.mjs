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
  "netlists/phase-9-heldout-flash-adc-4bit/circuit.spi",
);
const projectPath = resolve(
  "fixtures/agent-layout-eval/heldout-flash-adc-4bit-start.icproj.json",
);
const reportPath = resolve(
  "fixtures/agent-layout-eval/heldout-flash-adc-4bit-import-report.json",
);

const imported = await importSpiceSources(
  [{ path: "circuit.spi", bytes: await readFile(sourcePath) }],
  "circuit.spi",
);
if (!imported.successful || !imported.project)
  throw new Error(
    `Held-out flash ADC import failed: ${imported.diagnostics
      .map((item) => `${item.code}: ${item.message}`)
      .join("; ")}`,
  );
const project = imported.project;
const top = project.documents.find((item) => item.name === "flash_adc_4bit");
const comparator = project.documents.find((item) => item.name === "flash_cmp");
if (!top || !comparator || project.topDocumentId !== top.id)
  throw new Error("Held-out flash ADC hierarchy or top Document is incorrect");
const references = top.instances.filter(
  (instance) => instance.properties["spice.target"] === "subcircuit:flash_cmp",
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
  topInstances: top.instances.length === 31,
  comparatorInstances: comparator.instances.length === 9,
  comparatorReferences: references.length === 15,
  topPorts: top.ports.length === 21,
  comparatorPorts: comparator.ports.length === 6,
  topNets: top.nets.length === 36,
  comparatorNets: comparator.nets.length === 10,
  genericInstances: genericInstances.length === 0,
  elaboratedMosCount: references.length * comparator.instances.length === 135,
  importErrors:
    imported.diagnostics.filter((item) => item.severity === "error").length ===
    0,
};
if (!Object.values(assertions).every(Boolean))
  throw new Error(
    `Held-out fixture assertions failed: ${JSON.stringify(assertions)}`,
  );

const report = {
  version: "1.0",
  status: "held-out-after-knowledge-freeze",
  source: "netlists/phase-9-heldout-flash-adc-4bit/circuit.spi",
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
  comparatorReferences: references.length,
  elaboratedMosCount: references.length * comparator.instances.length,
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
    throw new Error("Held-out flash ADC starting Project is stale");
  if ((await readFile(reportPath, "utf8")) !== reportText)
    throw new Error("Held-out flash ADC import report is stale");
} else {
  await writeFile(projectPath, projectText);
  await writeFile(reportPath, reportText);
}
process.stdout.write(reportText);
