import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

import {
  buildAgentSessionSnapshot,
  createAgentCircuitService,
} from "../packages/agent-adapter/dist/index.js";
import {
  CircuitProjectSchema,
  SchematicDocumentSchema,
  createEmptyProject,
} from "../packages/model/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import {
  InMemorySymbolResolver,
  builtInSymbols,
  resolvePdkSymbolMapping,
} from "../packages/symbols/dist/index.js";

const check = process.argv.includes("--check");
const reportPath = resolve(
  "fixtures/agent-layout-eval/generalization-and-performance.json",
);
const renderPath = resolve(
  "fixtures/agent-layout-eval/unseen-transistor-128.svg",
);
const resolver = new InMemorySymbolResolver(builtInSymbols);
const budgets = {
  maxSnapshotBytes: 4_000_000,
  maxEstimatedTokens: 1_000_000,
  snapshot128Milliseconds: 1_000,
  snapshot500Milliseconds: 1_500,
  render128Milliseconds: 2_000,
};

function terminal(instanceId, pinName) {
  return { instanceId, pinName };
}

function endpoint(instanceId, pinName) {
  return { kind: "terminal", instanceId, pinName };
}

function route(id, netId, from, to, waypoints = []) {
  return {
    id,
    netId,
    from,
    to,
    waypoints,
    segmentModes: Array.from({ length: waypoints.length + 1 }, () => "manual"),
  };
}

function buildLargeProject(count, prefix = "Q") {
  const rowLengths =
    count === 128
      ? [11, 17, 13, 19, 15, 18, 16, 19]
      : Array.from({ length: Math.ceil(count / 25) }, (_, row) =>
          Math.min(25, count - row * 25),
        );
  const rows = rowLengths.length;
  const locations = rowLengths.flatMap((length, row) =>
    Array.from({ length }, (_, column) => ({ row, column })),
  );
  const base = createEmptyProject(
    `phase-9-large-${count}-${prefix}`,
    `Unseen transistor stress ${count}`,
  );
  const instances = Array.from({ length: count }, (_, index) => {
    const { row, column } = locations[index];
    const symbolId = row < Math.ceil(rows / 2) ? "pmos" : "nmos";
    return {
      id: `${prefix}${String(index + 1).padStart(3, "0")}`,
      symbolId,
      placement: {
        position: {
          x: 140 + column * 120 + (row % 2) * 20,
          y: 140 + row * 160,
        },
        rotation: 0,
        mirror: "none",
      },
      properties: {
        "spice.name": `${prefix}${index + 1}`,
        "spice.target": `model:stress_${symbolId}`,
        "spice.param.w": String(8 + ((index * 7) % 19)),
        "spice.param.l": index % 5 === 0 ? "0.18u" : "0.15u",
      },
    };
  });
  const nets = [
    {
      id: `${prefix}-vdd`,
      name: "VDD",
      scope: "global",
      terminals: [],
      ports: [],
    },
    {
      id: `${prefix}-vss`,
      name: "VSS",
      scope: "global",
      terminals: [],
      ports: [],
    },
  ];
  const routes = [];
  const ports = [
    {
      id: `${prefix}-port-vdd`,
      name: "VDD",
      direction: "passive",
      position: { x: 80, y: 170 },
    },
    {
      id: `${prefix}-port-vss`,
      name: "VSS",
      direction: "passive",
      position: {
        x: 80,
        y: 140 + Math.ceil(rows / 2) * 160 + 30,
      },
    },
  ];
  nets[0].ports.push(ports[0].id);
  nets[1].ports.push(ports[1].id);

  let firstIndex = 0;
  const previousRailInstance = new Map();
  for (let row = 0; row < rows; row += 1) {
    const rowCount = rowLengths[row];
    if (rowCount <= 0) break;
    const rowInstances = instances.slice(firstIndex, firstIndex + rowCount);
    const rail = rowInstances[0].symbolId === "pmos" ? nets[0] : nets[1];
    const previous = previousRailInstance.get(rail.id);
    if (previous) {
      const previousSource = {
        x: previous.placement.position.x + 20,
        y: previous.placement.position.y + 30,
      };
      const currentSource = {
        x: rowInstances[0].placement.position.x + 20,
        y: rowInstances[0].placement.position.y + 30,
      };
      routes.push(
        route(
          `${prefix}-route-rail-row-${row}`,
          rail.id,
          endpoint(previous.id, "S"),
          endpoint(rowInstances[0].id, "S"),
          [
            { x: 20, y: previousSource.y },
            { x: 20, y: currentSource.y },
          ],
        ),
      );
    }
    previousRailInstance.set(rail.id, rowInstances[0]);
    const inputPort = {
      id: `${prefix}-in-${row}`,
      name: `IN${row}`,
      direction: "input",
      position: { x: 40, y: rowInstances[0].placement.position.y },
    };
    const outputPort = {
      id: `${prefix}-out-${row}`,
      name: `OUT${row}`,
      direction: "output",
      position: {
        x: rowInstances.at(-1).placement.position.x + 90,
        y: rowInstances.at(-1).placement.position.y - 30,
      },
    };
    ports.push(inputPort, outputPort);

    const inputNet = {
      id: `${prefix}-signal-${row}-0`,
      name: `PATH_${row}_0`,
      scope: "local",
      terminals: [terminal(rowInstances[0].id, "G")],
      ports: [inputPort.id],
    };
    nets.push(inputNet);
    routes.push(
      route(
        `${prefix}-route-in-${row}`,
        inputNet.id,
        { kind: "port", portId: inputPort.id },
        endpoint(rowInstances[0].id, "G"),
      ),
    );

    for (const [column, instance] of rowInstances.entries()) {
      rail.terminals.push(
        terminal(instance.id, "S"),
        terminal(instance.id, "B"),
      );
      routes.push(
        route(
          `${prefix}-route-bulk-${row}-${column}`,
          rail.id,
          endpoint(instance.id, "S"),
          endpoint(instance.id, "B"),
          [
            {
              x: instance.placement.position.x + 30,
              y: instance.placement.position.y + 30,
            },
          ],
        ),
      );
      if (column > 0) {
        routes.push(
          route(
            `${prefix}-route-rail-${row}-${column}`,
            rail.id,
            endpoint(rowInstances[column - 1].id, "S"),
            endpoint(instance.id, "S"),
          ),
        );
      }
      if (column < rowInstances.length - 1) {
        const next = rowInstances[column + 1];
        const signalNet = {
          id: `${prefix}-signal-${row}-${column + 1}`,
          name: `PATH_${row}_${column + 1}`,
          scope: "local",
          terminals: [terminal(instance.id, "D"), terminal(next.id, "G")],
          ports: [],
        };
        nets.push(signalNet);
        routes.push(
          route(
            `${prefix}-route-signal-${row}-${column}`,
            signalNet.id,
            endpoint(instance.id, "D"),
            endpoint(next.id, "G"),
            [
              {
                x: next.placement.position.x - 30,
                y: instance.placement.position.y - 30,
              },
            ],
          ),
        );
      } else {
        const outputNet = {
          id: `${prefix}-signal-${row}-out`,
          name: `PATH_${row}_OUT`,
          scope: "local",
          terminals: [terminal(instance.id, "D")],
          ports: [outputPort.id],
        };
        nets.push(outputNet);
        routes.push(
          route(
            `${prefix}-route-out-${row}`,
            outputNet.id,
            endpoint(instance.id, "D"),
            { kind: "port", portId: outputPort.id },
          ),
        );
      }
    }
    firstIndex += rowCount;
  }

  const firstPmos = instances.find((instance) => instance.symbolId === "pmos");
  const firstNmos = instances.find((instance) => instance.symbolId === "nmos");
  if (firstPmos) {
    routes.push(
      route(
        `${prefix}-route-vdd-port`,
        nets[0].id,
        { kind: "port", portId: ports[0].id },
        endpoint(firstPmos.id, "S"),
      ),
    );
  }
  if (firstNmos) {
    routes.push(
      route(
        `${prefix}-route-vss-port`,
        nets[1].id,
        { kind: "port", portId: ports[1].id },
        endpoint(firstNmos.id, "S"),
      ),
    );
  }

  const document = SchematicDocumentSchema.parse({
    ...base.documents[0],
    id: `${prefix}-document-large-${count}`,
    name: `unseen_transistor_stress_${count}`,
    ports,
    instances,
    nets,
    routes,
    presentation: {
      ...base.documents[0].presentation,
      compactness: "compact",
      flow: { power: "top", ground: "bottom", input: "left", output: "right" },
    },
    layoutGroups: Array.from(
      { length: Math.min(16, Math.floor(count / 2)) },
      (_, index) => ({
        id: `${prefix}-pair-${index}`,
        kind: index % 2 === 0 ? "matched-pair" : "custom",
        objectIds: [instances[index * 2].id, instances[index * 2 + 1].id],
        locked: false,
      }),
    ),
    constraints: [],
  });
  return CircuitProjectSchema.parse({
    ...base,
    topDocumentId: document.id,
    documents: [document],
  });
}

function structuralSignature(document) {
  const symbolByInstance = new Map(
    document.instances.map((instance) => [instance.id, instance.symbolId]),
  );
  return JSON.stringify(
    document.nets
      .map((net) => ({
        scope: net.scope,
        ports: net.ports.length,
        terminals: net.terminals
          .map(
            (item) =>
              `${symbolByInstance.get(item.instanceId)}.${item.pinName}`,
          )
          .sort(),
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  );
}

function measure(action) {
  const started = performance.now();
  const result = action();
  return { result, milliseconds: performance.now() - started };
}

const project128 = buildLargeProject(128, "Q");
let activeDocument = project128.documents[0];
const project500 = buildLargeProject(500, "Z");
const snapshot128 = measure(() =>
  buildAgentSessionSnapshot({
    project: project128,
    document: activeDocument,
    resolver,
  }),
);
const snapshot500 = measure(() =>
  buildAgentSessionSnapshot({
    project: project500,
    document: project500.documents[0],
    resolver,
  }),
);
const initialTopology = structuralSignature(activeDocument);
const service = createAgentCircuitService({
  agentId: "phase-9-generalization",
  store: {
    getDocument: () => activeDocument,
    commitDocument: (document) => {
      activeDocument = document;
    },
    getProject: () => ({
      ...project128,
      documents: [activeDocument],
    }),
  },
  resolver,
  permissions: {
    query: true,
    snapshot: true,
    render: true,
    sourceSpans: false,
    edit: { geometry: true, connectivity: true, presentation: true },
  },
});
const edits = activeDocument.nets
  .filter((net) => net.id.includes("-signal-"))
  .slice(0, 4)
  .map((net) => ({
    kind: "set_net_name",
    netId: net.id,
    name: `${net.name}_reviewed`,
  }));
const transaction = {
  apiVersion: "2.0",
  requestId: "large-edit-dry-run",
  operation: "transact",
  documentId: activeDocument.id,
  transactionId: "large-edit-1",
  expectedRevision: 0,
  edits,
};
const dryRun = service.handle({ ...transaction, dryRun: true });
const committed = service.handle({
  ...transaction,
  requestId: "large-edit-commit",
  dryRun: false,
});
const refreshed = service.handle({
  apiVersion: "2.0",
  requestId: "large-refresh",
  operation: "snapshot",
  documentId: activeDocument.id,
});
const render128 = measure(() =>
  renderDocumentSvg(activeDocument, resolver, {
    title: "Phase 9 unseen 128-transistor stress",
  }),
);

const reordered = structuredClone(project128);
reordered.documents[0].instances.reverse();
reordered.documents[0].nets.reverse();
reordered.documents[0].routes.reverse();
reordered.documents[0].ports.reverse();
reordered.documents[0].layoutGroups.reverse();
const reorderedSnapshot = buildAgentSessionSnapshot({
  project: reordered,
  document: reordered.documents[0],
  resolver,
});
const renamed = buildLargeProject(128, "opaque");
const asymmetric = structuredClone(project128.documents[0]);
asymmetric.instances[3].symbolId = "nmos";
SchematicDocumentSchema.parse(asymmetric);

const snapshotRows = [
  [128, snapshot128],
  [500, snapshot500],
].map(([count, measurement]) => ({
  instances: count,
  byteLength: measurement.result.byteLength,
  estimatedTokens: Math.ceil(measurement.result.byteLength / 4),
  underByteBudget: measurement.result.byteLength <= budgets.maxSnapshotBytes,
  underTokenBudget:
    Math.ceil(measurement.result.byteLength / 4) <= budgets.maxEstimatedTokens,
}));
const performancePassed =
  snapshot128.milliseconds <= budgets.snapshot128Milliseconds &&
  snapshot500.milliseconds <= budgets.snapshot500Milliseconds &&
  render128.milliseconds <= budgets.render128Milliseconds;
const report = {
  version: "1.0",
  fixture: {
    id: "unseen-transistor-stress-128",
    purpose:
      "name-independent, non-fixture-specific Snapshot/edit/render stress; not an analog performance model",
    instances: 128,
    nets: project128.documents[0].nets.length,
    routes: project128.documents[0].routes.length,
    ports: project128.documents[0].ports.length,
  },
  snapshotMeasurements: snapshotRows,
  workflow: {
    apiVersion: "2.0",
    queryCalls: 0,
    optionalHelpersEnabled: false,
    dryRunAccepted: dryRun.ok === true && dryRun.applied === false,
    commitAccepted: committed.ok === true && committed.applied === true,
    refreshedRevision:
      refreshed.ok && refreshed.operation === "snapshot"
        ? refreshed.revision
        : null,
    topologyPreserved: structuralSignature(activeDocument) === initialTopology,
    finalDiagnosticCount:
      refreshed.ok && refreshed.operation === "snapshot"
        ? refreshed.snapshot.document.diagnostics.filter(
            (diagnostic) => diagnostic.severity === "error",
          ).length
        : null,
  },
  generalization: {
    persistedOrderInvariant:
      reorderedSnapshot.electricalTopologyHash ===
      snapshot128.result.electricalTopologyHash,
    renamedIdsPreserveStructuralEvidence:
      structuralSignature(renamed.documents[0]) === initialTopology,
    deliberateAsymmetryDetected:
      structuralSignature(asymmetric) !== initialTopology,
    unknownPdkRemainsUnresolved:
      resolvePdkSymbolMapping("unknown_fd_pr__nfet_01v8", 4) === undefined,
  },
  render: {
    svgBytes: Buffer.byteLength(render128.result),
    formalLayerPresent: render128.result.includes('data-layer="formal"'),
    editorOverlayAbsent: !render128.result.includes("editor-overlay"),
  },
  budgets,
  performanceWithinBudgets: performancePassed,
  passed: false,
};
report.passed =
  report.snapshotMeasurements.every(
    (item) => item.underByteBudget && item.underTokenBudget,
  ) &&
  report.workflow.queryCalls === 0 &&
  report.workflow.optionalHelpersEnabled === false &&
  report.workflow.dryRunAccepted &&
  report.workflow.commitAccepted &&
  report.workflow.topologyPreserved &&
  report.workflow.finalDiagnosticCount === 0 &&
  report.workflow.refreshedRevision === 1 &&
  Object.values(report.generalization).every(Boolean) &&
  report.render.formalLayerPresent &&
  report.render.editorOverlayAbsent &&
  report.performanceWithinBudgets;

const reportText = `${JSON.stringify(report, null, 2)}\n`;
if (check) {
  const expectedReport = await readFile(reportPath, "utf8");
  const expectedRender = await readFile(renderPath, "utf8");
  if (expectedReport !== reportText) throw new Error("Phase 9 report is stale");
  if (expectedRender !== render128.result)
    throw new Error("Phase 9 128-transistor render is stale");
} else {
  await mkdir(resolve("fixtures/agent-layout-eval"), { recursive: true });
  await writeFile(reportPath, reportText);
  await writeFile(renderPath, render128.result);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ...report,
      observedMilliseconds: {
        snapshot128: Number(snapshot128.milliseconds.toFixed(3)),
        snapshot500: Number(snapshot500.milliseconds.toFixed(3)),
        render128: Number(render128.milliseconds.toFixed(3)),
      },
    },
    null,
    2,
  )}\n`,
);
if (!report.passed) process.exitCode = 1;
