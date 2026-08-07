import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAgentCircuitService } from "../packages/agent-adapter/dist/index.js";
import { parseProject } from "../packages/model/dist/index.js";
import { importSpiceSources } from "../packages/spice/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../packages/symbols/dist/index.js";

const cases = [
  {
    id: "rlc-bandpass",
    sourceRoot: "netlists/rlc-rf-bandpass-100mhz",
    sourceFiles: ["circuit.spi"],
    entry: "circuit.spi",
    target:
      "netlists/rlc-rf-bandpass-100mhz/razavi-100mhz-bandpass.icproj.json",
  },
  {
    id: "hierarchical-cdac",
    sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
    sourceFiles: ["circuit.spi"],
    entry: "circuit.spi",
    target:
      "netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac.icproj.json",
  },
];

const outputPath = resolve(
  "fixtures/agent-layout-eval/recovery-layout-replay.json",
);
const check = process.argv.includes("--check");

function topologySignature(document) {
  return JSON.stringify(
    [...document.nets]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((net) => ({
        id: net.id,
        terminals: [...net.terminals].sort(
          (left, right) =>
            left.instanceId.localeCompare(right.instanceId, "en") ||
            left.pinName.localeCompare(right.pinName, "en"),
        ),
        ports: [...net.ports].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
      })),
  );
}

function pinMapBetween(source, target) {
  const result = {};
  for (const [key, sourcePin] of Object.entries(source.properties)) {
    if (!key.startsWith("spice.pin.") || typeof sourcePin !== "string")
      continue;
    const targetPin = target.properties[key];
    if (typeof targetPin === "string" && targetPin !== sourcePin) {
      result[sourcePin] = targetPin;
    }
  }
  return result;
}

function buildPhases(source, target) {
  const sourceInstanceById = new Map(
    source.instances.map((instance) => [instance.id, instance]),
  );
  const sourcePortById = new Map(source.ports.map((port) => [port.id, port]));
  const structure = [];
  for (const targetInstance of target.instances) {
    const sourceInstance = sourceInstanceById.get(targetInstance.id);
    if (!sourceInstance)
      throw new Error(`Missing instance ${targetInstance.id}`);
    if (
      sourceInstance.symbolId !== targetInstance.symbolId ||
      sourceInstance.symbolVariantId !== targetInstance.symbolVariantId
    ) {
      structure.push({
        kind: "set_instance_symbol",
        instanceId: targetInstance.id,
        symbolId: targetInstance.symbolId,
        symbolVariantId: targetInstance.symbolVariantId ?? null,
        pinMap: pinMapBetween(sourceInstance, targetInstance),
      });
    }
    if (targetInstance.placement) {
      if (sourceInstance.placement) {
        throw new Error(
          `Replay expects imported instance ${targetInstance.id} unplaced`,
        );
      }
      structure.push({
        kind: "place_instance",
        instanceId: targetInstance.id,
        placement: targetInstance.placement,
      });
    }
  }
  for (const targetPort of target.ports) {
    const sourcePort = sourcePortById.get(targetPort.id);
    if (!sourcePort) throw new Error(`Missing port ${targetPort.id}`);
    if (targetPort.position) {
      structure.push({
        kind: sourcePort.position ? "move_port" : "place_port",
        portId: targetPort.id,
        position: targetPort.position,
      });
    }
  }
  return [
    { id: "structure", edits: structure },
    {
      id: "junctions",
      edits: target.junctions.map((junction) => ({
        kind: "add_junction",
        junctionId: junction.id,
        netId: junction.netId,
        position: junction.position,
      })),
    },
    {
      id: "routes",
      edits: target.routes.map((route) => ({
        kind: "set_route_points",
        routeId: route.id,
        netId: route.netId,
        from: route.from,
        to: route.to,
        waypoints: route.waypoints,
        segmentModes: route.segmentModes,
      })),
    },
    {
      id: "annotations",
      edits: target.annotations.map((annotation) => ({
        kind: "upsert_annotation",
        annotation,
      })),
    },
    {
      id: "groups",
      edits: target.layoutGroups.map((group) => ({
        kind: "set_layout_group",
        group,
      })),
    },
    {
      id: "constraints",
      edits: target.constraints.map((constraint) => ({
        kind: "set_layout_constraint",
        constraint,
      })),
    },
  ];
}

function countByKind(edits) {
  return Object.fromEntries(
    [...new Set(edits.map((edit) => edit.kind))]
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((kind) => [kind, edits.filter((edit) => edit.kind === kind).length]),
  );
}

const caseReports = [];
for (const definition of cases) {
  const sourceFiles = await Promise.all(
    definition.sourceFiles.map(async (path) => ({
      path,
      bytes: await readFile(resolve(definition.sourceRoot, path)),
    })),
  );
  const imported = await importSpiceSources(sourceFiles, definition.entry);
  if (!imported.successful || !imported.project) {
    throw new Error(`${definition.id}: import failed`);
  }
  const project = imported.project;
  const targetProject = parseProject(
    await readFile(resolve(definition.target), "utf8"),
  );
  const resolver = createProjectSymbolResolver(project, builtInSymbols);
  let currentDocument = project.documents[0];
  const service = createAgentCircuitService({
    agentId: "phase-9-layout-replay",
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
        currentDocument = document;
        return document;
      },
      commitDocument: (next) => {
        project.documents = project.documents.map((document) =>
          document.id === next.id ? next : document,
        );
        currentDocument = next;
      },
      getProject: () => project,
    },
  });

  let transactions = 0;
  let dryRuns = 0;
  const documentReports = [];
  for (const targetDocument of targetProject.documents) {
    const sourceDocument = project.documents.find(
      (candidate) => candidate.id === targetDocument.id,
    );
    if (!sourceDocument) continue;
    currentDocument = sourceDocument;
    const initialTopology = topologySignature(sourceDocument);
    const initial = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${sourceDocument.id}-initial`,
      operation: "snapshot",
      documentId: sourceDocument.id,
    });
    if (!initial.ok || initial.operation !== "snapshot") {
      throw new Error(
        `${definition.id}/${sourceDocument.name}: initial Snapshot failed`,
      );
    }
    const phases = buildPhases(sourceDocument, targetDocument);
    const allEdits = phases.flatMap((phase) => phase.edits);
    for (const phase of phases) {
      for (
        let offset = 0;
        offset < phase.edits.length;
        offset += service.limits.maxTransactionEdits
      ) {
        const edits = phase.edits.slice(
          offset,
          offset + service.limits.maxTransactionEdits,
        );
        transactions += 1;
        const request = {
          apiVersion: "2.0",
          requestId: `${definition.id}-${sourceDocument.id}-${transactions}`,
          operation: "transact",
          documentId: sourceDocument.id,
          transactionId: `${definition.id}-${sourceDocument.id}-${phase.id}-${transactions}`,
          expectedRevision: currentDocument.revision,
          edits,
        };
        dryRuns += 1;
        const dryRun = service.handle({ ...request, dryRun: true });
        if (!dryRun.ok) throw new Error(JSON.stringify(dryRun, null, 2));
        const committed = service.handle(request);
        if (!committed.ok) throw new Error(JSON.stringify(committed, null, 2));
      }
    }
    const final = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${sourceDocument.id}-final`,
      operation: "snapshot",
      documentId: sourceDocument.id,
    });
    const render = service.handle({
      apiVersion: "2.0",
      requestId: `${definition.id}-${sourceDocument.id}-render`,
      operation: "render",
      documentId: sourceDocument.id,
      mode: "diagnostics",
    });
    if (!final.ok || final.operation !== "snapshot") {
      throw new Error(
        `${definition.id}/${sourceDocument.name}: final Snapshot failed`,
      );
    }
    if (!render.ok || render.operation !== "render") {
      throw new Error(`${definition.id}/${sourceDocument.name}: render failed`);
    }
    if (topologySignature(currentDocument) !== initialTopology) {
      throw new Error(
        `${definition.id}/${sourceDocument.name}: topology changed`,
      );
    }
    const presentationMatches =
      JSON.stringify(
        currentDocument.instances.map((item) => item.placement),
      ) ===
        JSON.stringify(
          targetDocument.instances.map((item) => item.placement),
        ) &&
      JSON.stringify(currentDocument.ports.map((item) => item.position)) ===
        JSON.stringify(targetDocument.ports.map((item) => item.position)) &&
      JSON.stringify(currentDocument.routes) ===
        JSON.stringify(targetDocument.routes) &&
      JSON.stringify(currentDocument.junctions) ===
        JSON.stringify(targetDocument.junctions) &&
      JSON.stringify(currentDocument.annotations) ===
        JSON.stringify(targetDocument.annotations);
    if (!presentationMatches) {
      throw new Error(
        `${definition.id}/${sourceDocument.name}: presentation mismatch`,
      );
    }
    documentReports.push({
      id: sourceDocument.id,
      name: sourceDocument.name,
      initialRevision: initial.revision,
      finalRevision: final.revision,
      initialSnapshotBytes: initial.snapshot.byteLength,
      finalSnapshotBytes: final.snapshot.byteLength,
      editCounts: countByKind(allEdits),
      finalDiagnostics: countByKind(
        final.snapshot.document.diagnostics.map((diagnostic) => ({
          kind: diagnostic.code,
        })),
      ),
      renderBytes: render.artifact.byteLength,
      renderSha256: render.artifact.sha256,
      topologyPreserved: true,
      presentationMatchesTarget: true,
    });
  }
  caseReports.push({
    id: definition.id,
    apiVersion: "2.0",
    queryCalls: 0,
    helpersEnabled: false,
    transactions,
    dryRuns,
    documents: documentReports,
  });
}

const report = { reportVersion: "1.0", cases: caseReports };
const text = `${JSON.stringify(report, null, 2)}\n`;
if (check) {
  if ((await readFile(outputPath, "utf8")) !== text) {
    throw new Error("Phase 9 recovery layout replay is stale");
  }
} else {
  await writeFile(outputPath, text, "utf8");
}
process.stdout.write(text);
