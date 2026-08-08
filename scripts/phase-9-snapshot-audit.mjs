import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAgentCircuitService } from "../packages/agent-adapter/dist/index.js";
import { importSpiceSources } from "../packages/spice/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../packages/symbols/dist/index.js";

const cases = [
  {
    id: "rlc-bandpass",
    root: "netlists/rlc-rf-bandpass-100mhz",
    files: ["circuit.spi"],
    entry: "circuit.spi",
  },
  {
    id: "hierarchical-cdac",
    root: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
    files: ["circuit.spi"],
    entry: "circuit.spi",
  },
  {
    id: "unseen-ota",
    root: "netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt",
    files: ["circuit.spi"],
    entry: "circuit.spi",
  },
  {
    id: "hierarchical-divide-by-two",
    root: "netlists/sky130-transistor-divide-by-2",
    files: ["circuit.spi"],
    entry: "circuit.spi",
  },
];

const outputPath = resolve(
  "fixtures/agent-layout-eval/post-gap-snapshot-audit.json",
);
const check = process.argv.includes("--check");

async function importCase(definition) {
  const sources = await Promise.all(
    definition.files.map(async (path) => ({
      path,
      bytes: await readFile(resolve(definition.root, path)),
    })),
  );
  const imported = await importSpiceSources(sources, definition.entry);
  if (!imported.successful || !imported.project) {
    throw new Error(
      `${definition.id}: ${imported.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`,
    );
  }
  return { project: imported.project, importDiagnostics: imported.diagnostics };
}

const results = [];
let advertisedEditKinds = [];
for (const definition of cases) {
  const { project, importDiagnostics } = await importCase(definition);
  const resolver = createProjectSymbolResolver(project, builtInSymbols);
  let selectedDocument = project.documents.find(
    (document) => document.id === project.topDocumentId,
  );
  if (!selectedDocument)
    throw new Error(`${definition.id}: top Document missing`);
  const service = createAgentCircuitService({
    agentId: "phase-9-snapshot-audit",
    resolver,
    permissions: {
      query: true,
      snapshot: true,
      render: true,
      sourceSpans: false,
      edit: { geometry: true, connectivity: true, presentation: true },
    },
    store: {
      getDocument: (documentId) => {
        const document = project.documents.find(
          (candidate) => candidate.id === documentId,
        );
        if (!document) throw new Error(`Unknown Document ${documentId}`);
        selectedDocument = document;
        return document;
      },
      commitDocument: (next) => {
        project.documents = project.documents.map((document) =>
          document.id === next.id ? next : document,
        );
        selectedDocument = next;
      },
      getProject: () => project,
    },
  });
  const capabilities = service.handle({
    apiVersion: "2.0",
    requestId: `${definition.id}-capabilities`,
    operation: "capabilities",
  });
  if (!capabilities.ok || capabilities.operation !== "capabilities") {
    throw new Error(`${definition.id}: v2 capabilities failed`);
  }
  advertisedEditKinds = capabilities.capabilities.editKinds;

  const documents = [];
  for (const document of project.documents) {
    const snapshotResponse = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${document.id}-snapshot`,
      operation: "snapshot",
      documentId: document.id,
    });
    if (!snapshotResponse.ok || snapshotResponse.operation !== "snapshot") {
      throw new Error(`${definition.id}/${document.name}: Snapshot failed`);
    }
    const snapshot = snapshotResponse.snapshot;
    const dryRun = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${document.id}-dry-run`,
      operation: "transact",
      documentId: document.id,
      transactionId: `${definition.id}-${document.id}-noop`,
      expectedRevision: snapshot.document.revision,
      dryRun: true,
      edits: [{ kind: "noop" }],
    });
    if (!dryRun.ok || dryRun.operation !== "transact" || dryRun.applied) {
      throw new Error(`${definition.id}/${document.name}: v2 dry run failed`);
    }
    const render = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${document.id}-render`,
      operation: "render",
      documentId: document.id,
      mode: "diagnostics",
    });
    if (!render.ok || render.operation !== "render") {
      throw new Error(`${definition.id}/${document.name}: render failed`);
    }

    const diagnosticCounts = Object.fromEntries(
      [...new Set(snapshot.document.diagnostics.map((item) => item.code))]
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((code) => [
          code,
          snapshot.document.diagnostics.filter((item) => item.code === code)
            .length,
        ]),
    );
    documents.push({
      id: document.id,
      name: document.name,
      revision: document.revision,
      instances: snapshot.document.instances.length,
      ports: snapshot.document.ports.length,
      nets: snapshot.document.nets.length,
      routes: snapshot.document.routes.length,
      unplacedInstances: snapshot.document.instances.filter(
        (instance) => instance.placement === null,
      ).length,
      unplacedPorts: snapshot.document.ports.filter(
        (port) => port.position === null,
      ).length,
      unresolvedPins: snapshot.document.instances.reduce(
        (total, instance) =>
          total +
          instance.pins.filter((pin) => pin.visibility === "unknown").length,
        0,
      ),
      genericSymbols: snapshot.document.instances.filter((instance) =>
        instance.symbolId.startsWith("generic-block-"),
      ).length,
      snapshotBytes: snapshot.byteLength,
      electricalTopologyHash: snapshot.electricalTopologyHash,
      diagnosticCounts,
      renderBytes: render.artifact.byteLength,
    });
  }

  results.push({
    id: definition.id,
    apiOperations: capabilities.capabilities.operations,
    queryCalls: 0,
    documentCount: project.documents.length,
    referenceCount: capabilities.ok
      ? project.documents.reduce(
          (total, document) =>
            total +
            document.instances.filter((instance) =>
              String(instance.properties["spice.target"] ?? "").startsWith(
                "subcircuit:",
              ),
            ).length,
          0,
        )
      : 0,
    importWarnings: importDiagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    ).length,
    documents,
  });
}

const report = {
  reportVersion: "1.0",
  apiVersion: "2.0",
  snapshotVersion: "1.0",
  helpersEnabled: false,
  cases: results,
  observedGaps: {
    missingEditKinds: ["set_instance_symbol", "place_port", "move_port"].filter(
      (kind) => !advertisedEditKinds.includes(kind),
    ),
    remainingGenericInstances: results.reduce(
      (total, item) =>
        total +
        item.documents.reduce(
          (documentTotal, document) => documentTotal + document.genericSymbols,
          0,
        ),
      0,
    ),
    unplacedPorts: results.reduce(
      (total, item) =>
        total +
        item.documents.reduce(
          (documentTotal, document) => documentTotal + document.unplacedPorts,
          0,
        ),
      0,
    ),
  },
};

const text = `${JSON.stringify(report, null, 2)}\n`;
if (check) {
  if ((await readFile(outputPath, "utf8")) !== text) {
    throw new Error("Phase 9 Snapshot audit fixture is stale");
  }
} else {
  await writeFile(outputPath, text, "utf8");
}
process.stdout.write(text);
