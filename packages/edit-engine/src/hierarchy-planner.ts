import { semanticTextDocument } from "@icm/model";
import type {
  Annotation,
  CellSymbolPresentation,
  CellSymbolSide,
  CircuitProject,
  SchematicDocument,
} from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

import type { ProjectStructureEdit } from "./project-transaction.js";

type DocumentEdits = Extract<
  ProjectStructureEdit,
  { kind: "transact_document" }
>["edits"];

function requireDocument(project: CircuitProject, documentId: string) {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document) throw new Error(`Document does not exist: ${documentId}`);
  return document;
}

function transactDocument(
  project: CircuitProject,
  documentId: string,
  edits: DocumentEdits,
): ProjectStructureEdit {
  const document = requireDocument(project, documentId);
  return {
    kind: "transact_document",
    documentId,
    expectedRevision: document.revision,
    edits,
  };
}

/** Build the one canonical subcircuit Instance projection of a child Cell. */
export function createHierarchyInstance(
  id: string,
  child: Pick<SchematicDocument, "id" | "netlist">,
  placement: NonNullable<SchematicDocument["instances"][number]["placement"]>,
): SchematicDocument["instances"][number] {
  if (!child.netlist) {
    throw new Error(`Cell has no formal interface: ${child.id}`);
  }
  return {
    id,
    symbolId: hierarchicalSymbolId(child.netlist.name),
    placement,
    properties: {},
    netlist: {
      reference: id,
      parameters: {},
      terminals: child.netlist.terminals.map((terminal, sourcePosition) => ({
        sourcePosition,
        pinName: terminal.name,
      })),
      binding: {
        kind: "subcircuit",
        childDocumentId: child.id,
        name: child.netlist.name,
      },
    },
  };
}

export function planCreateCell(
  document: SchematicDocument,
): ProjectStructureEdit[] {
  return [{ kind: "add_document", document }];
}

export function planCreateCellFromDraftingObject(
  project: CircuitProject,
  parentDocumentId: string,
  child: SchematicDocument,
  instance: SchematicDocument["instances"][number],
  draftingObjectId: string,
): ProjectStructureEdit[] {
  const parent = requireDocument(project, parentDocumentId);
  if (project.documents.some((document) => document.id === child.id)) {
    throw new Error(`Document already exists: ${child.id}`);
  }
  const binding = instance.netlist?.binding;
  if (binding?.kind !== "subcircuit" || binding.childDocumentId !== child.id) {
    throw new Error("Created hierarchy Instance must bind the new child Cell");
  }
  return [
    { kind: "add_document", document: child },
    {
      kind: "transact_document",
      documentId: parent.id,
      expectedRevision: parent.revision,
      edits: [
        { kind: "remove_drafting_object", objectId: draftingObjectId },
        { kind: "add_instance", instance },
      ],
    },
  ];
}

export function planRenameCell(
  project: CircuitProject,
  documentId: string,
  name: string,
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  if (document.name === name) return [];
  return [{ kind: "rename_document", documentId, name }];
}

export function planDeleteCell(
  project: CircuitProject,
  documentId: string,
): ProjectStructureEdit[] {
  requireDocument(project, documentId);
  return [{ kind: "remove_document", documentId }];
}

export function planPlaceCellInstance(
  project: CircuitProject,
  parentDocumentId: string,
  instance: SchematicDocument["instances"][number],
  annotations: readonly Annotation[] = [],
): ProjectStructureEdit[] {
  const binding = instance.netlist?.binding;
  if (binding?.kind !== "subcircuit") {
    throw new Error(`Instance is not bound to a Cell: ${instance.id}`);
  }
  requireDocument(project, binding.childDocumentId);
  return [
    transactDocument(project, parentDocumentId, [
      { kind: "add_instance", instance },
      ...annotations.map((annotation) => ({
        kind: "upsert_schematic_annotation" as const,
        annotation,
      })),
    ]),
  ];
}

export function planCreateCellPort(
  project: CircuitProject,
  documentId: string,
  input: {
    instance: SchematicDocument["instances"][number];
    connectionEdits: DocumentEdits;
    terminal: NonNullable<SchematicDocument["netlist"]>["terminals"][number];
    annotation?: Annotation;
  },
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  if (!document.netlist)
    throw new Error(`Cell has no interface: ${documentId}`);
  if (input.instance.id !== input.terminal.interfaceInstanceId) {
    throw new Error("Cell terminal must reference the placed Port Instance");
  }
  if (
    input.instance.symbolId !== "port" &&
    input.instance.symbolId !== "port-filled"
  ) {
    throw new Error(
      `Cell interface marker must be a Port: ${input.instance.symbolId}`,
    );
  }
  if (
    document.netlist.terminals.some((item) => item.name === input.terminal.name)
  ) {
    throw new Error(
      `Cell terminal name already exists: ${input.terminal.name}`,
    );
  }
  return [
    transactDocument(project, documentId, [
      { kind: "add_instance", instance: input.instance },
      ...input.connectionEdits,
      { kind: "add_cell_terminal", terminal: input.terminal },
      ...(input.annotation
        ? [
            {
              kind: "upsert_schematic_annotation" as const,
              annotation: input.annotation,
            },
          ]
        : []),
    ]),
  ];
}

export function planUpdateCellTerminalDirection(
  project: CircuitProject,
  documentId: string,
  terminalId: string,
  direction: "input" | "output" | "inout" | "passive",
): ProjectStructureEdit[] {
  return [
    transactDocument(project, documentId, [
      { kind: "update_cell_terminal", terminalId, direction },
    ]),
  ];
}

export function planReorderCellTerminal(
  project: CircuitProject,
  documentId: string,
  terminalId: string,
  delta: -1 | 1,
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  const terminals = document.netlist?.terminals ?? [];
  const index = terminals.findIndex((terminal) => terminal.id === terminalId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= terminals.length) return [];
  const terminalIds = terminals.map((terminal) => terminal.id);
  [terminalIds[index], terminalIds[next]] = [
    terminalIds[next]!,
    terminalIds[index]!,
  ];
  return [
    transactDocument(project, documentId, [
      { kind: "reorder_cell_terminals", terminalIds },
    ]),
  ];
}

export function planSetCellTerminalPlacement(
  project: CircuitProject,
  documentId: string,
  terminalId: string,
  side: CellSymbolSide | "auto",
  offset: number,
): ProjectStructureEdit[] {
  if (!Number.isInteger(offset) || offset % 10 !== 0) {
    throw new Error("Cell Port position must be a multiple of 10");
  }
  const document = requireDocument(project, documentId);
  const current = document.presentation.cellSymbol;
  const pinPlacements = (current?.pinPlacements ?? []).filter(
    (placement) => placement.terminalId !== terminalId,
  );
  if (side !== "auto") pinPlacements.push({ terminalId, side, offset });
  return planSetCellSymbolPresentation(project, documentId, {
    ...(current?.minimumBodySize
      ? { minimumBodySize: current.minimumBodySize }
      : {}),
    ...(pinPlacements.length > 0 ? { pinPlacements } : {}),
  });
}

/**
 * Plans one definition-level hierarchy block presentation change. The Project
 * wrapper is deliberate: the changed child Symbol is visible to every caller
 * at the same structural revision, while terminal identities stay unchanged.
 */
export function planSetCellSymbolPresentation(
  project: CircuitProject,
  documentId: string,
  presentation: CellSymbolPresentation | null,
): ProjectStructureEdit[] {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document?.netlist) {
    throw new Error(`Cell does not exist: ${documentId}`);
  }
  return [
    {
      kind: "transact_document",
      documentId,
      expectedRevision: document.revision,
      edits: [{ kind: "set_cell_symbol_presentation", presentation }],
    },
  ];
}

/**
 * Plans one atomic formal-port rename and updates every connected caller
 * through the existing set_instance_symbol pin-reconciliation edit.
 */
export function planRenameCellTerminal(
  project: CircuitProject,
  childDocumentId: string,
  terminalId: string,
  newName: string,
): ProjectStructureEdit[] {
  const child = project.documents.find(
    (document) => document.id === childDocumentId,
  );
  const terminal = child?.netlist?.terminals.find(
    (candidate) => candidate.id === terminalId,
  );
  if (!child?.netlist || !terminal) {
    throw new Error(
      `Cell terminal does not exist: ${childDocumentId}.${terminalId}`,
    );
  }
  if (terminal.name === newName) return [];
  if (
    child.netlist.terminals.some(
      (candidate) => candidate.id !== terminalId && candidate.name === newName,
    )
  ) {
    throw new Error(`Cell terminal name already exists: ${newName}`);
  }

  const edits: ProjectStructureEdit[] = [
    {
      kind: "transact_document",
      documentId: child.id,
      expectedRevision: child.revision,
      edits: [
        { kind: "update_cell_terminal", terminalId, name: newName },
        ...child.annotations
          .filter(
            (annotation) =>
              annotation.kind === "instance-label" &&
              annotation.anchor.kind === "object" &&
              annotation.anchor.objectId === terminal.interfaceInstanceId,
          )
          .map((annotation) => ({
            kind: "upsert_schematic_annotation" as const,
            annotation: {
              ...annotation,
              content: semanticTextDocument(newName, "instance-label"),
            },
          })),
      ],
    },
  ];
  for (const parent of project.documents) {
    const callerEdits: Extract<
      ProjectStructureEdit,
      { kind: "transact_document" }
    >["edits"] = [];
    for (const instance of parent.instances) {
      const binding = instance.netlist?.binding;
      if (
        binding?.kind !== "subcircuit" ||
        binding.childDocumentId !== child.id
      )
        continue;
      const referencesOldPin =
        parent.nets.some((net) =>
          net.terminals.some(
            (reference) =>
              reference.instanceId === instance.id &&
              reference.pinName === terminal.name,
          ),
        ) ||
        parent.routes.some((route) =>
          [route.from, route.to].some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              endpoint.instanceId === instance.id &&
              endpoint.pinName === terminal.name,
          ),
        ) ||
        parent.noConnects.some(
          (noConnect) =>
            noConnect.endpoint.instanceId === instance.id &&
            noConnect.endpoint.pinName === terminal.name,
        ) ||
        (instance.netlist?.terminals ?? []).some(
          (reference) => reference.pinName === terminal.name,
        );
      if (!referencesOldPin) continue;
      callerEdits.push({
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: hierarchicalSymbolId(child.netlist.name),
        pinMap: { [terminal.name]: newName },
      });
    }
    if (callerEdits.length > 0) {
      edits.push({
        kind: "transact_document",
        documentId: parent.id,
        expectedRevision: parent.revision,
        edits: callerEdits,
      });
    }
  }
  return edits;
}

export function planExposePortInstance(
  project: CircuitProject,
  documentId: string,
  terminal: {
    id: string;
    name: string;
    netId: string;
    direction: "input" | "output" | "inout" | "passive";
    interfaceInstanceId: string;
  },
): ProjectStructureEdit[] {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document) throw new Error(`Document does not exist: ${documentId}`);
  return [
    {
      kind: "transact_document",
      documentId,
      expectedRevision: document.revision,
      edits: [{ kind: "add_cell_terminal", terminal }],
    },
  ];
}

export function planRemoveCellTerminal(
  project: CircuitProject,
  documentId: string,
  terminalId: string,
  instanceDeletionEdits?: DocumentEdits,
): ProjectStructureEdit[] {
  return planRemoveCellTerminals(
    project,
    documentId,
    [terminalId],
    instanceDeletionEdits,
  );
}

/**
 * Removes independent Cell Ports in one Project transaction. Callers that are
 * electrically connected to a port remain protected; unprotected selected
 * Ports and ordinary schematic objects can still be removed atomically.
 */
export function planRemoveCellTerminals(
  project: CircuitProject,
  documentId: string,
  terminalIds: readonly string[],
  instanceDeletionEdits?: DocumentEdits,
): ProjectStructureEdit[] {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document?.netlist) throw new Error(`Cell does not exist: ${documentId}`);
  const requestedIds = new Set(terminalIds);
  if (requestedIds.size === 0) return [];
  const terminals = [...requestedIds].map((terminalId) => {
    const terminal = document.netlist!.terminals.find(
      (item) => item.id === terminalId,
    );
    if (!terminal) {
      throw new Error(
        `Cell terminal does not exist: ${documentId}.${terminalId}`,
      );
    }
    const caller = findCellTerminalCaller(project, documentId, terminal.name);
    if (caller) {
      throw new Error(
        `Cell terminal ${terminal.name} is still referenced by ${caller.parent.id}.${caller.instance.id}`,
      );
    }
    return terminal;
  });
  const terminalInstanceIds = new Set(
    terminals.map((terminal) => terminal.interfaceInstanceId),
  );
  const terminalNames = new Set(terminals.map((terminal) => terminal.name));
  const edits: Extract<
    ProjectStructureEdit,
    { kind: "transact_document" }
  >["edits"] = [];
  if (
    !instanceDeletionEdits &&
    document.routes.some((route) =>
      [route.from, route.to].some(
        (endpoint) =>
          endpoint.kind === "terminal" &&
          terminalInstanceIds.has(endpoint.instanceId),
      ),
    )
  ) {
    throw new Error(
      "Remove wire geometry from Cell Ports before deleting them",
    );
  }
  for (const noConnect of document.noConnects) {
    if (terminalInstanceIds.has(noConnect.endpoint.instanceId)) {
      edits.push({ kind: "remove_no_connect", noConnectId: noConnect.id });
    }
  }
  if (
    !instanceDeletionEdits &&
    document.nets.some((net) =>
      net.terminals.some(
        (reference) =>
          terminalInstanceIds.has(reference.instanceId) &&
          reference.pinName === "P",
      ),
    )
  ) {
    for (const terminal of terminals) {
      edits.push({
        kind: "disconnect_endpoint",
        endpoint: {
          kind: "terminal",
          instanceId: terminal.interfaceInstanceId,
          pinName: "P",
        },
      });
    }
  }
  edits.push(
    ...(instanceDeletionEdits ?? []),
    ...(instanceDeletionEdits
      ? []
      : document.annotations
          .filter(
            (annotation) =>
              annotation.anchor.kind === "object" &&
              terminalInstanceIds.has(annotation.anchor.objectId),
          )
          .map((annotation) => ({
            kind: "remove_schematic_annotation" as const,
            annotationId: annotation.id,
          }))),
    ...terminals.map((terminal) => ({
      kind: "remove_cell_terminal" as const,
      terminalId: terminal.id,
    })),
    ...(instanceDeletionEdits
      ? []
      : terminals.map((terminal) => ({
          kind: "remove_instance" as const,
          instanceId: terminal.interfaceInstanceId,
        }))),
  );
  const structureEdits: ProjectStructureEdit[] = [
    {
      kind: "transact_document",
      documentId,
      expectedRevision: document.revision,
      edits,
    },
  ];
  for (const parent of project.documents) {
    const callerEdits: Extract<
      ProjectStructureEdit,
      { kind: "transact_document" }
    >["edits"] = [];
    for (const instance of parent.instances) {
      const binding = instance.netlist?.binding;
      if (
        binding?.kind !== "subcircuit" ||
        binding.childDocumentId !== documentId ||
        !instance.netlist?.terminals?.some((reference) =>
          terminalNames.has(reference.pinName),
        )
      ) {
        continue;
      }
      callerEdits.push({
        kind: "set_instance_netlist",
        instanceId: instance.id,
        netlist: {
          ...structuredClone(instance.netlist),
          terminals: instance.netlist.terminals
            .filter((reference) => !terminalNames.has(reference.pinName))
            .map((reference, sourcePosition) => ({
              ...reference,
              sourcePosition,
            })),
        },
      });
    }
    if (callerEdits.length > 0) {
      structureEdits.push({
        kind: "transact_document",
        documentId: parent.id,
        expectedRevision: parent.revision,
        edits: callerEdits,
      });
    }
  }
  return structureEdits;
}

export function findCellTerminalCaller(
  project: CircuitProject,
  childDocumentId: string,
  terminalName: string,
):
  | {
      parent: SchematicDocument;
      instance: SchematicDocument["instances"][number];
    }
  | undefined {
  return project.documents
    .flatMap((parent) =>
      parent.instances.map((instance) => ({ parent, instance })),
    )
    .find(({ parent, instance }) => {
      const binding = instance.netlist?.binding;
      return (
        binding?.kind === "subcircuit" &&
        binding.childDocumentId === childDocumentId &&
        documentElectricallyReferencesPin(parent, instance.id, terminalName)
      );
    });
}

function documentElectricallyReferencesPin(
  parent: CircuitProject["documents"][number],
  instanceId: string,
  pinName: string,
): boolean {
  return (
    parent.nets.some((net) =>
      net.terminals.some(
        (reference) =>
          reference.instanceId === instanceId && reference.pinName === pinName,
      ),
    ) ||
    parent.routes.some((route) =>
      [route.from, route.to].some(
        (endpoint) =>
          endpoint.kind === "terminal" &&
          endpoint.instanceId === instanceId &&
          endpoint.pinName === pinName,
      ),
    ) ||
    parent.noConnects.some(
      (noConnect) =>
        noConnect.endpoint.instanceId === instanceId &&
        noConnect.endpoint.pinName === pinName,
    )
  );
}
