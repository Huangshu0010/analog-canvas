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
  "netlists/phase-9-heldout-chopper-afe-8ch/circuit.spi",
);
const projectPath = resolve(
  "fixtures/agent-layout-eval/heldout-chopper-afe-8ch-start.icproj.json",
);
const reportPath = resolve(
  "fixtures/agent-layout-eval/heldout-chopper-afe-8ch-import-report.json",
);

const imported = await importSpiceSources(
  [{ path: "circuit.spi", bytes: await readFile(sourcePath) }],
  "circuit.spi",
);
if (!imported.successful || !imported.project)
  throw new Error(
    `Held-out chopper AFE import failed: ${imported.diagnostics
      .map((item) => `${item.code}: ${item.message}`)
      .join("; ")}`,
  );
const project = imported.project;
const top = project.documents.find((item) => item.name === "chopper_afe_8ch");
const channel = project.documents.find(
  (item) => item.name === "chopper_channel",
);
if (!top || !channel || project.topDocumentId !== top.id)
  throw new Error(
    "Held-out chopper AFE hierarchy or top Document is incorrect",
  );
const references = top.instances.filter(
  (instance) =>
    instance.properties["spice.target"] === "subcircuit:chopper_channel",
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
  channelInstances: channel.instances.length === 18,
  channelReferences: references.length === 8,
  topPorts: top.ports.length === 37,
  channelPorts: channel.ports.length === 9,
  topNets: top.nets.length === 37,
  channelNets: channel.nets.length === 16,
  genericInstances: genericInstances.length === 0,
  elaboratedMosCount: references.length * channel.instances.length === 144,
  importErrors:
    imported.diagnostics.filter((item) => item.severity === "error").length ===
    0,
};
if (!Object.values(assertions).every(Boolean))
  throw new Error(
    `Held-out chopper fixture assertions failed: ${JSON.stringify(assertions)}`,
  );

const report = {
  version: "1.0",
  status: "held-out-after-run-1-remediation-freeze",
  source: "netlists/phase-9-heldout-chopper-afe-8ch/circuit.spi",
  topologyOnly: true,
  simulated: false,
  documents: snapshots.map((snapshot) => ({
    id: snapshot.document.id,
    name: snapshot.document.name,
    instances: snapshot.document.instances.length,
    nets: snapshot.document.nets.length,
    ports: snapshot.document.ports.length,
    snapshotBytes: snapshot.byteLength,
    electricalTopologyHash: snapshot.electricalTopologyHash,
  })),
  channelReferences: references.length,
  elaboratedMosCount: references.length * channel.instances.length,
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
    throw new Error("Held-out chopper AFE starting Project is stale");
  if ((await readFile(reportPath, "utf8")) !== reportText)
    throw new Error("Held-out chopper AFE import report is stale");
} else {
  await writeFile(projectPath, projectText);
  await writeFile(reportPath, reportText);
}
process.stdout.write(reportText);
