import {
  createEmptyDocument,
  deriveStableId,
  type CircuitProject,
  type Instance,
  type SchematicDocument,
} from "@icm/model";

export const VARIABLE_RESISTOR_SYMBOL_ID = "variable-resistor";

export interface VariableResistorCellResolution {
  readonly document: SchematicDocument;
  readonly created: boolean;
}

export function variableResistorCellId(projectId: string): string {
  return deriveStableId("variable-resistor-cell", projectId);
}

function nextCellName(project: CircuitProject): string {
  const occupied = new Set(
    project.documents.flatMap((document) =>
      document.netlist?.name ? [document.netlist.name.toLowerCase()] : [],
    ),
  );
  let suffix = 1;
  while (
    occupied.has(
      (suffix === 1
        ? "VariableResistor"
        : `VariableResistor_${suffix}`
      ).toLowerCase(),
    )
  ) {
    suffix += 1;
  }
  return suffix === 1 ? "VariableResistor" : `VariableResistor_${suffix}`;
}

function createVariableResistorCell(
  project: CircuitProject,
): SchematicDocument {
  const document = createEmptyDocument(
    variableResistorCellId(project.id),
    "Variable Resistor",
  );
  const port1Id = deriveStableId("port", document.id, "P1");
  const port2Id = deriveStableId("port", document.id, "P2");
  const resistorId = deriveStableId("resistor", document.id, "R1");
  const net1Id = deriveStableId("net", document.id, "P1");
  const net2Id = deriveStableId("net", document.id, "P2");

  document.netlist = {
    name: nextCellName(project),
    terminals: [
      {
        id: deriveStableId("terminal", document.id, "P1"),
        name: "P1",
        netId: net1Id,
        direction: "passive",
        interfaceInstanceId: port1Id,
      },
      {
        id: deriveStableId("terminal", document.id, "P2"),
        name: "P2",
        netId: net2Id,
        direction: "passive",
        interfaceInstanceId: port2Id,
      },
    ],
    formalParameters: [{ name: "value", defaultValue: "10k" }],
  };
  document.instances = [
    {
      id: port1Id,
      symbolId: "port",
      placement: {
        position: { x: 0, y: -40 },
        rotation: 90,
        mirror: "none",
      },
    },
    {
      id: resistorId,
      symbolId: "resistor",
      schematicReference: "R1",
      placement: {
        position: { x: 0, y: 0 },
        rotation: 0,
        mirror: "none",
      },
      netlist: {
        reference: "R1",
        binding: { kind: "primitive", deviceClass: "resistor" },
        parameters: { value: "{value}" },
      },
    },
    {
      id: port2Id,
      symbolId: "port",
      placement: {
        position: { x: 0, y: 40 },
        rotation: 270,
        mirror: "none",
      },
    },
  ];
  document.nets = [
    {
      id: net1Id,
      scope: "local",
      terminals: [
        { instanceId: port1Id, pinName: "P" },
        { instanceId: resistorId, pinName: "1" },
      ],
      origin: { kind: "authored" },
    },
    {
      id: net2Id,
      scope: "local",
      terminals: [
        { instanceId: port2Id, pinName: "P" },
        { instanceId: resistorId, pinName: "2" },
      ],
      origin: { kind: "authored" },
    },
  ];
  document.routes = [
    {
      id: deriveStableId("route", document.id, "P1"),
      netId: net1Id,
      from: { kind: "terminal", instanceId: port1Id, pinName: "P" },
      to: { kind: "terminal", instanceId: resistorId, pinName: "1" },
      waypoints: [],
      segmentModes: ["auto"],
    },
    {
      id: deriveStableId("route", document.id, "P2"),
      netId: net2Id,
      from: { kind: "terminal", instanceId: resistorId, pinName: "2" },
      to: { kind: "terminal", instanceId: port2Id, pinName: "P" },
      waypoints: [],
      segmentModes: ["auto"],
    },
  ];
  return document;
}

export function resolveVariableResistorCell(
  project: CircuitProject,
): VariableResistorCellResolution {
  const id = variableResistorCellId(project.id);
  const existing = project.documents.find((document) => document.id === id);
  return existing
    ? { document: existing, created: false }
    : { document: createVariableResistorCell(project), created: true };
}

export function bindVariableResistorInstance(
  instance: Instance,
  childDocumentId: string,
): Instance {
  if (instance.symbolId !== VARIABLE_RESISTOR_SYMBOL_ID || !instance.netlist) {
    throw new Error("A variable-resistor instance requires netlist data");
  }
  return {
    ...instance,
    netlist: {
      ...instance.netlist,
      binding: { kind: "subcircuit", childDocumentId },
    },
  };
}
