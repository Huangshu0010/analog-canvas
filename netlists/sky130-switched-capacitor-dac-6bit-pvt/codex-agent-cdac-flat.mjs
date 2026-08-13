// End-to-end Agent API v2 evaluation for a genuinely flattened 6-bit CDAC.
//
// The Agent owns placement and per-Net RouteTreeDecision choices. The
// @icm/agent-routing expander owns coordinate arithmetic and emits typed edits.
// Decisions are transient and are never persisted into the Project.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAgentCircuitService } from "../../packages/agent-adapter/dist/index.js";
import {
  deriveCrossings,
  deriveFlightlines,
  diagnoseVisualQuality,
} from "../../packages/derived/dist/index.js";
import { expandRouteTree } from "../../packages/agent-routing/dist/index.js";
import { createFormalExportSource } from "../../packages/exporters/dist/index.js";
import { exportFormalArtifacts } from "../../packages/exporters/dist/node.js";
import {
  serializeProject,
  validateProject,
} from "../../packages/model/dist/index.js";
import { importSpiceSources } from "../../packages/spice/dist/index.js";
import {
  builtInSymbols,
  createProjectSymbolResolver,
} from "../../packages/symbols/dist/index.js";
import { flattenDocument } from "../../tools/agent-layout/flatten-project.mjs";

const SOURCE_ROOT = resolve("netlists/sky130-switched-capacitor-dac-6bit-pvt");
const OUTPUT_BASE = resolve(SOURCE_ROOT, "codex-agent-cdac-flat");
const CELL_ORIGINS = Array.from({ length: 6 }, (_, index) => 220 + index * 300);
const CAPACITOR_XS = CELL_ORIGINS.map((origin) => origin + 240);
const VOUT_Y = 70;
const CAP_Y = 90;
const PMOS_Y = 300;
const LOGIC_Y = 345;
const NMOS_Y = 390;
const LOCAL_VDD_Y = 230;
const LOCAL_VSS_Y = 460;
const RESET_X = 2140;
const RESET_Y = 90;

const sourceBytes = await readFile(resolve(SOURCE_ROOT, "circuit.spi"));
const imported = await importSpiceSources(
  [{ path: "circuit.spi", bytes: sourceBytes }],
  "circuit.spi",
);
if (!imported.successful || !imported.project) {
  throw new Error(
    imported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
  );
}

const project = imported.project;
project.name = "SKY130 6-bit CDAC - Agent v2 flat evaluation";
const document = flattenDocument(
  project,
  "switched_capacitor_dac_6bit",
  "switched_capacitor_dac_6bit_flat_agent_v2",
);
document.presentation = {
  ...document.presentation,
  styleProfileId: "razavi-textbook-v1",
  compactness: "compact",
  flow: { power: "top", ground: "bottom", input: "left", output: "right" },
};
project.documents.push(document);
project.topDocumentId = document.id;

const resolver = createProjectSymbolResolver(project, builtInSymbols);
let currentDocument = document;
const store = {
  getDocument: (documentId) => {
    if (documentId && documentId !== currentDocument.id) {
      throw new Error(`Unexpected Document ${documentId}`);
    }
    return currentDocument;
  },
  commitDocument: (next) => {
    currentDocument = next;
    project.documents = project.documents.map((candidate) =>
      candidate.id === next.id ? next : candidate,
    );
  },
  getProject: () => project,
};
const service = createAgentCircuitService({
  agentId: "codex-cdac-flat-v2",
  store,
  resolver,
  permissions: {
    query: true,
    snapshot: true,
    render: true,
    sourceSpans: true,
    edit: { geometry: true, connectivity: true, presentation: true },
  },
});

const capabilities = service.handle({
  apiVersion: "2.0",
  requestId: "cdac-capabilities",
  operation: "capabilities",
});
if (!capabilities.ok || capabilities.operation !== "capabilities") {
  throw new Error(`Capabilities failed: ${JSON.stringify(capabilities)}`);
}
for (const required of ["snapshot", "transact", "render"]) {
  if (!capabilities.capabilities.operations.includes(required)) {
    throw new Error(`Agent API 2.0 is missing ${required}`);
  }
}

let transactionIndex = 0;
const transactionTrace = [];
async function transactPhase(phase, edits) {
  const limit = capabilities.capabilities.limits.maxTransactionEdits;
  for (let offset = 0; offset < edits.length; offset += limit) {
    const batch = edits.slice(offset, offset + limit);
    transactionIndex += 1;
    const request = {
      apiVersion: "2.0",
      requestId: `cdac-${phase}-${transactionIndex}`,
      operation: "transact",
      documentId: currentDocument.id,
      transactionId: `cdac-${phase}-${transactionIndex}`,
      expectedRevision: currentDocument.revision,
      edits: batch,
    };
    const dryRun = service.handle({ ...request, dryRun: true });
    if (!dryRun.ok) {
      throw new Error(`Dry-run ${phase} failed: ${JSON.stringify(dryRun)}`);
    }
    const committed = service.handle(request);
    if (!committed.ok) {
      throw new Error(`Commit ${phase} failed: ${JSON.stringify(committed)}`);
    }
    transactionTrace.push({
      phase,
      editCount: batch.length,
      dryRunResolvedRoutes: dryRun.resolvedRoutes?.length ?? 0,
      committedResolvedRoutes: committed.resolvedRoutes?.length ?? 0,
      fromRevision: request.expectedRevision,
      toRevision: committed.revision,
    });
  }
}

function netByName(name) {
  const net = currentDocument.nets.find((candidate) => candidate.name === name);
  if (!net) throw new Error(`Missing Net ${name}`);
  return net;
}

function portByName(name) {
  const port = currentDocument.ports.find(
    (candidate) => candidate.name === name,
  );
  if (!port) throw new Error(`Missing Port ${name}`);
  return port;
}

function terminal(instanceId, pinName) {
  return { kind: "terminal", instanceId, pinName };
}

function portEndpoint(name) {
  return { kind: "port", portId: portByName(name).id };
}

// Agent placement decision: six repeated branches ordered B0 (LSB) to B5
// (MSB), common plate above, local supplies around each CMOS driver.
const placements = {
  CDUMMY: [100, CAP_Y, 0, "none"],
  XRESET: [RESET_X, RESET_Y, 0, "none"],
};
for (let index = 0; index < 6; index += 1) {
  const origin = CELL_ORIGINS[index];
  placements[`C${index}`] = [CAPACITOR_XS[index], CAP_Y, 0, "none"];
  placements[`XU${index}__XDP`] = [origin + 50, PMOS_Y, 180, "x"];
  placements[`XU${index}__XDN`] = [origin + 50, NMOS_Y, 0, "none"];
  placements[`XU${index}__XSP`] = [origin + 150, PMOS_Y, 180, "x"];
  placements[`XU${index}__XSN`] = [origin + 150, NMOS_Y, 0, "none"];
}

const portPositions = {
  vout: { x: 90, y: VOUT_Y },
  vdd: { x: 80, y: LOCAL_VDD_Y },
  vss: { x: 80, y: LOCAL_VSS_Y },
  reset: { x: RESET_X - 90, y: RESET_Y },
  ...Object.fromEntries(
    CELL_ORIGINS.map((origin, index) => [
      `b${index}`,
      { x: origin - 25, y: LOGIC_Y },
    ]),
  ),
};

const structureEdits = [];
for (const instance of currentDocument.instances) {
  const placement = placements[instance.id];
  if (!placement) throw new Error(`No placement decision for ${instance.id}`);
  const [x, y, rotation, mirror] = placement;
  if (instance.symbolId === "nmos" || instance.symbolId === "pmos") {
    structureEdits.push({
      kind: "set_instance_symbol",
      instanceId: instance.id,
      symbolId: instance.symbolId,
      symbolVariantId: "textbook-3terminal",
    });
  }
  structureEdits.push({
    kind: "place_instance",
    instanceId: instance.id,
    placement: { position: { x, y }, rotation, mirror },
  });
}
for (const port of currentDocument.ports) {
  const position = portPositions[port.name];
  if (!position) throw new Error(`No port placement for ${port.name}`);
  structureEdits.push({ kind: "place_port", portId: port.id, position });
}

// Presentation-only local power symbols. They are explicitly connected to the
// already imported VDD/VSS Nets through typed edits.
const powerHelpers = [];
for (let index = 0; index < 6; index += 1) {
  powerHelpers.push(
    {
      id: `PVDD${index}`,
      symbolId: "vdd",
      pinName: "P",
      netName: "vdd",
      position: { x: CELL_ORIGINS[index] + 140, y: LOCAL_VDD_Y },
    },
    {
      id: `PGND${index}`,
      symbolId: "ground",
      pinName: "0",
      netName: "vss",
      position: { x: CELL_ORIGINS[index] + 140, y: LOCAL_VSS_Y },
    },
  );
}
powerHelpers.push(
  {
    id: "PGND-DUMMY",
    symbolId: "ground",
    pinName: "0",
    netName: "vss",
    position: { x: 100, y: 180 },
  },
  {
    id: "PGND-RESET",
    symbolId: "ground",
    pinName: "0",
    netName: "vss",
    position: { x: RESET_X + 10, y: 170 },
  },
);
for (const helper of powerHelpers) {
  structureEdits.push(
    {
      kind: "add_instance",
      instance: {
        id: helper.id,
        symbolId: helper.symbolId,
        placement: {
          position: helper.position,
          rotation: 0,
          mirror: "none",
        },
        properties: { "presentation.role": "local-power" },
      },
    },
    {
      kind: "connect_endpoints",
      from: terminal(helper.id, helper.pinName),
      to: portEndpoint(helper.netName),
    },
  );
}
await transactPhase("structure", structureEdits);

function snapshot(requestId) {
  const response = service.handle({
    apiVersion: "2.0",
    requestId,
    operation: "snapshot",
    documentId: currentDocument.id,
  });
  if (!response.ok || response.operation !== "snapshot") {
    throw new Error(`Snapshot failed: ${JSON.stringify(response)}`);
  }
  return response.snapshot;
}

const placedSnapshot = snapshot("cdac-snapshot-placed");
const snapshotNetByName = new Map(
  placedSnapshot.document.nets.map((net) => [net.name, net]),
);
const snapshotInstanceById = new Map(
  placedSnapshot.document.instances.map((instance) => [instance.id, instance]),
);
const snapshotPortById = new Map(
  placedSnapshot.document.ports.map((port) => [port.id, port]),
);

function outward(direction) {
  switch (direction) {
    case "north":
      return { x: 0, y: -1 };
    case "east":
      return { x: 1, y: 0 };
    case "south":
      return { x: 0, y: 1 };
    case "west":
      return { x: -1, y: 0 };
    default:
      return null;
  }
}

const endpointMap = new Map();
function terminalEndpointId(netName, instanceId, pinName) {
  return `${netName}:${instanceId}.${pinName}`;
}
function portEndpointId(netName, portId) {
  return `${netName}:port.${portId}`;
}
for (const net of placedSnapshot.document.nets) {
  for (const item of net.terminals) {
    const instance = snapshotInstanceById.get(item.instanceId);
    const pin = instance?.pins.find(
      (candidate) => candidate.name === item.pinName,
    );
    // Hidden MOS bulk terminals remain electrically present in the Net but are
    // intentionally not visible Route endpoints in the 3-terminal variant.
    if (!pin?.pagePosition || pin.visibility !== "visible") continue;
    const id = terminalEndpointId(net.name, item.instanceId, item.pinName);
    endpointMap.set(id, {
      id,
      endpoint: terminal(item.instanceId, item.pinName),
      point: pin.pagePosition,
      outward: outward(pin.direction),
    });
  }
  for (const portId of net.portIds) {
    const port = snapshotPortById.get(portId);
    if (!port?.position) continue;
    const id = portEndpointId(net.name, portId);
    endpointMap.set(id, {
      id,
      endpoint: { kind: "port", portId },
      point: port.position,
      outward: null,
    });
  }
}

const expansionInput = {
  endpoints: endpointMap,
  existingRoutePolylines: placedSnapshot.document.routes
    .filter((route) => route.polyline)
    .map((route) => ({ routeId: route.id, points: route.polyline })),
  instanceBoxes: placedSnapshot.document.instances
    .filter((instance) => instance.bounds)
    .map((instance) => ({
      instanceId: instance.id,
      min: { x: instance.bounds.x, y: instance.bounds.y },
      max: {
        x: instance.bounds.x + instance.bounds.width,
        y: instance.bounds.y + instance.bounds.height,
      },
    })),
};

const ep = (netName, instanceId, pinName) =>
  terminalEndpointId(netName, instanceId, pinName);
const pp = (netName) => portEndpointId(netName, portByName(netName).id);
const decision = (netName, shape, endpointGroups) => ({
  documentId: currentDocument.id,
  revision: placedSnapshot.document.revision,
  netId: snapshotNetByName.get(netName).id,
  shape,
  endpointGroups,
});

// Agent-owned topology decisions. These choices are not persisted.
const decisions = [];
decisions.push(
  decision("vout", "local-branch-tree", [
    {
      id: "common-plate",
      endpointIds: [
        pp("vout"),
        ep("vout", "CDUMMY", "1"),
        ...Array.from({ length: 6 }, (_, index) =>
          ep("vout", `C${index}`, "1"),
        ),
        ep("vout", "XRESET", "D"),
      ],
      attachTo: "net",
    },
  ]),
);

decisions.push(
  decision(
    "vdd",
    "labeled-islands",
    Array.from({ length: 6 }, (_, index) => ({
      id: `vdd-${index}`,
      endpointIds: [
        ep("vdd", `PVDD${index}`, "P"),
        ep("vdd", `XU${index}__XDP`, "S"),
        ep("vdd", `XU${index}__XSP`, "S"),
      ],
      attachTo: "net",
    })),
  ),
);
decisions.push(
  decision("vss", "labeled-islands", [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `vss-${index}`,
      endpointIds: [
        ep("vss", `PGND${index}`, "0"),
        ep("vss", `XU${index}__XDN`, "S"),
        ep("vss", `XU${index}__XSN`, "S"),
      ],
      attachTo: "net",
    })),
    {
      id: "vss-dummy",
      endpointIds: [ep("vss", "PGND-DUMMY", "0"), ep("vss", "CDUMMY", "2")],
      attachTo: "net",
    },
    {
      id: "vss-reset",
      endpointIds: [ep("vss", "PGND-RESET", "0"), ep("vss", "XRESET", "S")],
      attachTo: "net",
    },
  ]),
);

for (let index = 0; index < 6; index += 1) {
  decisions.push(
    decision(`b${index}`, "local-branch-tree", [
      {
        id: `bit-${index}`,
        endpointIds: [
          pp(`b${index}`),
          ep(`b${index}`, `XU${index}__XDP`, "G"),
          ep(`b${index}`, `XU${index}__XDN`, "G"),
        ],
        attachTo: "net",
      },
    ]),
    decision(`nb${index}`, "local-branch-tree", [
      {
        id: `nbit-${index}`,
        endpointIds: [
          ep(`nb${index}`, `XU${index}__XDP`, "D"),
          ep(`nb${index}`, `XU${index}__XDN`, "D"),
          ep(`nb${index}`, `XU${index}__XSP`, "G"),
          ep(`nb${index}`, `XU${index}__XSN`, "G"),
        ],
        attachTo: "net",
      },
    ]),
    decision(`bot${index}`, "local-branch-tree", [
      {
        id: `bottom-${index}`,
        endpointIds: [
          ep(`bot${index}`, `XU${index}__XSP`, "D"),
          ep(`bot${index}`, `XU${index}__XSN`, "D"),
          ep(`bot${index}`, `C${index}`, "2"),
        ],
        attachTo: "net",
      },
    ]),
  );
}
decisions.push(
  decision("reset", "direct", [
    {
      id: "reset-control",
      endpointIds: [pp("reset"), ep("reset", "XRESET", "G")],
      attachTo: "net",
    },
  ]),
);

const routeEdits = [];
const expansionConflicts = [];
const expansionMetrics = [];
const generatedIds = new Set();
for (const routeDecision of decisions) {
  const expansion = expandRouteTree(routeDecision, expansionInput);
  for (const objectId of expansion.generatedObjectIds) {
    if (generatedIds.has(objectId)) {
      throw new Error(`Duplicate generated object ID ${objectId}`);
    }
    generatedIds.add(objectId);
  }
  routeEdits.push(...expansion.edits);
  expansionConflicts.push(
    ...expansion.conflicts.map((conflict) => ({
      netId: routeDecision.netId,
      shape: routeDecision.shape,
      ...conflict,
    })),
  );
  expansionMetrics.push({
    netId: routeDecision.netId,
    shape: routeDecision.shape,
    ...expansion.metrics,
  });
}
await transactPhase("routes", routeEdits);

function annotation(input) {
  return {
    kind: "upsert_schematic_annotation",
    annotation: {
      offset: { x: 0, y: 0 },
      rotation: 0,
      locked: false,
      ...input,
    },
  };
}

const labelEdits = [
  annotation({
    id: "title-cdac-flat-agent",
    kind: "plain-text",
    text: "6-BIT SWITCHED-CAPACITOR DAC - FLAT TRANSISTOR VIEW",
    position: { x: 1100, y: 18 },
    alignment: "middle",
    locked: true,
  }),
  annotation({
    id: "label-vout",
    kind: "net-label",
    text: "VOUT",
    attachedObjectId: netByName("vout").id,
    position: { x: 28, y: VOUT_Y - 8 },
    alignment: "end",
  }),
  annotation({
    id: "label-reset",
    kind: "net-label",
    text: "RESET",
    attachedObjectId: portByName("reset").id,
    position: { x: RESET_X - 105, y: RESET_Y - 8 },
    alignment: "end",
  }),
  annotation({
    id: "label-vdd-port",
    kind: "power-label",
    text: "VDD",
    attachedObjectId: portByName("vdd").id,
    position: portPositions.vdd,
    alignment: "start",
  }),
  annotation({
    id: "label-vss-port",
    kind: "power-label",
    text: "VSS",
    attachedObjectId: portByName("vss").id,
    position: portPositions.vss,
    alignment: "start",
  }),
  annotation({
    id: "label-reset-instance",
    kind: "instance-label",
    text: "MRESET",
    attachedObjectId: "XRESET",
    position: { x: RESET_X + 45, y: RESET_Y + 8 },
    alignment: "start",
  }),
  annotation({
    id: "label-dummy",
    kind: "instance-label",
    text: "CDUMMY 16 fF",
    attachedObjectId: "CDUMMY",
    position: { x: 90, y: CAP_Y + 5 },
    alignment: "end",
  }),
];

for (const helper of powerHelpers) {
  labelEdits.push(
    annotation({
      id: `suppress-${helper.id}`,
      kind: "instance-label",
      text: "",
      attachedObjectId: helper.id,
      position: helper.position,
      alignment: "middle",
    }),
  );
}

const capacitorValues = [16, 32, 64, 128, 256, 512];
for (let index = 0; index < 6; index += 1) {
  const origin = CELL_ORIGINS[index];
  labelEdits.push(
    annotation({
      id: `label-b${index}`,
      kind: "net-label",
      text: `B${index}`,
      attachedObjectId: portByName(`b${index}`).id,
      position: { x: origin - 35, y: LOGIC_Y - 8 },
      alignment: "end",
    }),
    annotation({
      id: `label-nb${index}`,
      kind: "net-label",
      text: `NB${index}`,
      attachedObjectId: netByName(`nb${index}`).id,
      position: { x: origin + 100, y: LOGIC_Y - 10 },
      alignment: "middle",
    }),
    annotation({
      id: `label-C${index}`,
      kind: "instance-label",
      text: `C${index} ${capacitorValues[index]} fF`,
      attachedObjectId: `C${index}`,
      position: { x: CAPACITOR_XS[index] + 12, y: CAP_Y + 5 },
      alignment: "start",
    }),
  );
  for (const [child, label, x, y] of [
    ["XDP", `DP${index}`, origin + 90, PMOS_Y - 8],
    ["XDN", `DN${index}`, origin + 90, NMOS_Y + 18],
    ["XSP", `SP${index}`, origin + 190, PMOS_Y - 8],
    ["XSN", `SN${index}`, origin + 190, NMOS_Y + 18],
  ]) {
    labelEdits.push(
      annotation({
        id: `label-XU${index}-${child}`,
        kind: "instance-label",
        text: label,
        attachedObjectId: `XU${index}__${child}`,
        position: { x, y },
        alignment: "start",
      }),
    );
  }
}
await transactPhase("labels", labelEdits);

const finalSnapshot = snapshot("cdac-snapshot-final");
const renderResponse = service.handle({
  apiVersion: "2.0",
  requestId: "cdac-render-final",
  operation: "render",
  documentId: currentDocument.id,
  mode: "formal",
});
if (!renderResponse.ok || renderResponse.operation !== "render") {
  throw new Error(`Render failed: ${JSON.stringify(renderResponse)}`);
}

const validated = validateProject(project);
const exportSource = createFormalExportSource(currentDocument, resolver, {
  title: project.name,
  margin: 30,
});
const artifacts = await exportFormalArtifacts(exportSource, 3);
await Promise.all([
  writeFile(`${OUTPUT_BASE}.icproj.json`, serializeProject(validated), "utf8"),
  writeFile(`${OUTPUT_BASE}.svg`, artifacts.svg),
  writeFile(`${OUTPUT_BASE}.png`, artifacts.png.bytes),
  writeFile(`${OUTPUT_BASE}.pdf`, artifacts.pdf),
]);

const diagnostics = diagnoseVisualQuality(currentDocument, resolver);
const diagnosticCounts = Object.fromEntries(
  [...new Set(diagnostics.map((item) => item.code))]
    .sort()
    .map((code) => [
      code,
      diagnostics.filter((item) => item.code === code).length,
    ]),
);
const primitiveCounts = Object.fromEntries(
  [...new Set(currentDocument.instances.map((item) => item.symbolId))]
    .sort()
    .map((symbolId) => [
      symbolId,
      currentDocument.instances.filter((item) => item.symbolId === symbolId)
        .length,
    ]),
);
const remainingBlocks = currentDocument.instances.filter((instance) =>
  instance.symbolId.startsWith("hierarchical-symbol-"),
);

const result = {
  apiVersion: capabilities.apiVersion,
  snapshotVersion: finalSnapshot.snapshotVersion,
  documentId: currentDocument.id,
  revision: currentDocument.revision,
  transactions: transactionTrace,
  instances: currentDocument.instances.length,
  primitiveCounts,
  nets: currentDocument.nets.length,
  routes: currentDocument.routes.length,
  junctions: currentDocument.junctions.length,
  annotations: currentDocument.annotations.length,
  unplaced: currentDocument.instances.filter((item) => item.placement === null)
    .length,
  hierarchicalInstances: remainingBlocks.map((item) => item.id),
  flightlines: deriveFlightlines(currentDocument, resolver).length,
  crossings: deriveCrossings(currentDocument, resolver).length,
  diagnostics: diagnosticCounts,
  expansionConflicts,
  expansionMetrics,
  outputBase: OUTPUT_BASE,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
