import type {
  Annotation,
  CellSymbolPresentation,
  CellSymbolSide,
  CircuitProject,
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";
import { deriveStableId } from "@icm/model";
import {
  createReferenceIndex,
  hierarchyReferencePolicy,
  nextReference,
  referencePolicyForSymbol,
} from "@icm/devices";
import {
  builtInSymbols,
  createProjectSymbolResolver,
  externalSubcircuitSymbolId,
  hierarchicalSymbolId,
  resolvePdkSymbolMapping,
  resolvePdkSymbolMappingForTerminalOrder,
} from "@icm/symbols";

import type { ProjectStructureEdit } from "./project-transaction.js";
import {
  planInstanceDeletion,
  planTerminalDeletion,
} from "./instance-lifecycle.js";

type DocumentEdits = Extract<
  ProjectStructureEdit,
  { kind: "transact_document" }
>["edits"];

export interface SubcircuitInterfaceProposal {
  readonly source: {
    readonly structureRevision: number;
    readonly documentRevisions: Readonly<Record<string, number>>;
  };
  readonly target: {
    readonly kind: "internal" | "external";
    readonly id: string;
  };
  readonly callers: readonly {
    documentId: string;
    instanceId: string;
  }[];
  readonly diagnostics: readonly string[];
  readonly edits: readonly ProjectStructureEdit[];
}

function interfaceProposal(
  project: CircuitProject,
  target: SubcircuitInterfaceProposal["target"],
  edits: readonly ProjectStructureEdit[],
  diagnostics: readonly string[] = [],
): SubcircuitInterfaceProposal {
  const callers = project.documents.flatMap((document) =>
    document.instances.flatMap((instance) => {
      const binding = instance.netlist?.binding;
      const matches =
        (target.kind === "internal" &&
          binding?.kind === "subcircuit" &&
          binding.childDocumentId === target.id) ||
        (target.kind === "external" &&
          binding?.kind === "external-subcircuit" &&
          binding.definitionId === target.id);
      return matches
        ? [{ documentId: document.id, instanceId: instance.id }]
        : [];
    }),
  );
  return {
    source: {
      structureRevision: project.structureRevision,
      documentRevisions: Object.fromEntries(
        project.documents.map((document) => [document.id, document.revision]),
      ),
    },
    target,
    callers,
    diagnostics,
    edits,
  };
}

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

function externalDefinitionId(masterName: string): string {
  return deriveStableId("external-subcircuit", masterName.toLowerCase());
}

function externalTerminalId(masterName: string, index: number): string {
  return deriveStableId(
    "external-subcircuit-terminal",
    masterName.toLowerCase(),
    String(index),
  );
}

function matchingExternalMosDefinition(
  project: CircuitProject,
  definitionId: string,
) {
  const definition = project.externalSubcircuitDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition || definition.presentation) return undefined;
  const mapping = resolvePdkSymbolMappingForTerminalOrder(
    definition.name,
    definition.terminals.map((terminal) => terminal.name),
  );
  if (!mapping) return undefined;
  return { definition, mapping };
}

/**
 * Switches a reviewed four-terminal MOS between an ordinary model binding and
 * a SKY130 external X-call without changing the existing D/G/S/B connectivity.
 */
export function planSetMosModelTarget(
  project: CircuitProject,
  documentId: string,
  instanceId: string,
  modelName: string,
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  const instance = document.instances.find(
    (candidate) => candidate.id === instanceId,
  );
  if (!instance?.netlist) {
    throw new Error(`Netlisted Instance does not exist: ${instanceId}`);
  }
  const normalizedName = modelName.trim();
  const targetMapping = normalizedName
    ? resolvePdkSymbolMapping(normalizedName, 4)
    : undefined;
  const currentExternal =
    instance.netlist.binding?.kind === "external-subcircuit"
      ? matchingExternalMosDefinition(
          project,
          instance.netlist.binding.definitionId,
        )
      : undefined;
  const sourceMosSymbolId =
    currentExternal?.mapping.symbolId ?? instance.symbolId;
  if (sourceMosSymbolId !== "nmos" && sourceMosSymbolId !== "pmos") {
    throw new Error(
      "Only reviewed NMOS and PMOS targets can use the Model field",
    );
  }

  if (targetMapping) {
    if (targetMapping.symbolId !== sourceMosSymbolId) {
      throw new Error(
        `${normalizedName} is not compatible with the selected ${sourceMosSymbolId.toUpperCase()}`,
      );
    }
    const sameNameDefinition = project.externalSubcircuitDefinitions.find(
      (definition) =>
        definition.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    const definition =
      sameNameDefinition ??
      ({
        id: externalDefinitionId(normalizedName),
        name: normalizedName,
        terminals: targetMapping.pinNames.map((name, index) => ({
          id: externalTerminalId(normalizedName, index),
          name,
          direction: "passive" as const,
        })),
        formalParameters: [],
        interfaceStatus: "declared" as const,
      } satisfies ExternalSubcircuitDefinition);
    const verified = definition.presentation
      ? undefined
      : resolvePdkSymbolMappingForTerminalOrder(
          definition.name,
          definition.terminals.map((terminal) => terminal.name),
        );
    if (!verified || verified.symbolId !== sourceMosSymbolId) {
      throw new Error(
        `Existing external definition ${definition.name} does not declare D, G, S, B in reviewed order`,
      );
    }
    const symbolId = verified.symbolId;
    const reference =
      instance.netlist.binding?.kind === "external-subcircuit"
        ? instance.netlist.reference
        : nextReference(
            createReferenceIndex(document),
            hierarchyReferencePolicy,
          )!;
    const documentEdits: DocumentEdits = [];
    if (instance.symbolId !== symbolId) {
      documentEdits.push({
        kind: "set_instance_symbol",
        instanceId,
        symbolId,
      });
    }
    const netlist = {
      ...instance.netlist,
      reference,
      binding: {
        kind: "external-subcircuit" as const,
        definitionId: definition.id,
      },
    };
    if (JSON.stringify(instance.netlist) !== JSON.stringify(netlist)) {
      documentEdits.push({ kind: "set_instance_netlist", instanceId, netlist });
    }
    if (documentEdits.length === 0) return [];
    return [
      ...(sameNameDefinition
        ? []
        : [
            {
              kind: "upsert_external_subcircuit_definition" as const,
              definition,
            },
          ]),
      transactDocument(project, documentId, documentEdits),
    ];
  }

  const symbolId = sourceMosSymbolId;
  const reference = currentExternal
    ? nextReference(
        createReferenceIndex(document),
        referencePolicyForSymbol(symbolId),
      )!
    : instance.netlist.reference;
  const binding = normalizedName
    ? ({ kind: "model", deviceClass: "mos", name: normalizedName } as const)
    : undefined;
  const netlist = {
    reference,
    parameters: { ...instance.netlist.parameters },
    ...(binding ? { binding } : {}),
  };
  const documentEdits: DocumentEdits = [];
  if (instance.symbolId !== symbolId) {
    documentEdits.push({ kind: "set_instance_symbol", instanceId, symbolId });
  }
  if (JSON.stringify(instance.netlist) !== JSON.stringify(netlist)) {
    documentEdits.push({ kind: "set_instance_netlist", instanceId, netlist });
  }
  return documentEdits.length > 0
    ? [transactDocument(project, documentId, documentEdits)]
    : [];
}

/** Build the one canonical subcircuit Instance projection of a child Cell. */
export function createHierarchyInstance(
  id: string,
  child: Pick<SchematicDocument, "id" | "netlist">,
  placement: NonNullable<SchematicDocument["instances"][number]["placement"]>,
  reference = id,
): SchematicDocument["instances"][number] {
  if (!child.netlist) {
    throw new Error(`Cell has no formal interface: ${child.id}`);
  }
  return {
    id,
    symbolId: hierarchicalSymbolId(child.netlist.name),
    schematicReference: reference,
    placement,
    netlist: {
      reference,
      parameters: {},
      binding: {
        kind: "subcircuit",
        childDocumentId: child.id,
      },
    },
  };
}

/** Build an `X` call to a project-local external interface, without a fake Cell body. */
export function createExternalSubcircuitInstance(
  id: string,
  definition: ExternalSubcircuitDefinition,
  placement: NonNullable<SchematicDocument["instances"][number]["placement"]>,
  reference = id,
): SchematicDocument["instances"][number] {
  const mapping = definition.presentation
    ? undefined
    : resolvePdkSymbolMappingForTerminalOrder(
        definition.name,
        definition.terminals.map((terminal) => terminal.name),
      );
  return {
    id,
    symbolId: mapping?.symbolId ?? externalSubcircuitSymbolId(definition.id),
    schematicReference: reference,
    placement,
    netlist: {
      reference,
      parameters: {},
      binding: { kind: "external-subcircuit", definitionId: definition.id },
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
  const caller = project.documents
    .flatMap((parent) =>
      parent.instances.map((instance) => ({ parent, instance })),
    )
    .find(({ instance }) => {
      const binding = instance.netlist?.binding;
      return (
        binding?.kind === "subcircuit" && binding.childDocumentId === documentId
      );
    });
  if (caller) {
    throw new Error(
      `Cell ${documentId} is still referenced by ${caller.parent.id}.${caller.instance.id}`,
    );
  }
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

export function planPlaceExternalSubcircuitInstance(
  project: CircuitProject,
  parentDocumentId: string,
  instance: SchematicDocument["instances"][number],
  annotations: readonly Annotation[] = [],
): ProjectStructureEdit[] {
  const binding = instance.netlist?.binding;
  if (binding?.kind !== "external-subcircuit") {
    throw new Error(
      `Instance is not bound to an external subcircuit: ${instance.id}`,
    );
  }
  if (
    !project.externalSubcircuitDefinitions.some(
      (definition) => definition.id === binding.definitionId,
    )
  ) {
    throw new Error(
      `External subcircuit does not exist: ${binding.definitionId}`,
    );
  }
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

export function planCreateCellPin(
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
  if (!input.terminal.interfaceInstanceIds.includes(input.instance.id)) {
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
    document.netlist.terminals.some(
      (item) =>
        item.name.localeCompare(input.terminal.name, undefined, {
          sensitivity: "base",
        }) === 0,
    )
  ) {
    throw new Error(`Cell Pin name already exists: ${input.terminal.name}`);
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

/**
 * Add another drawing marker for an existing Cell Pin. The ordered interface
 * terminal remains singular; every marker projects the same name, direction,
 * and electrical Net.
 */
export function planAttachCellPinMarker(
  project: CircuitProject,
  documentId: string,
  input: {
    instance: SchematicDocument["instances"][number];
    connectionEdits: DocumentEdits;
    terminalId: string;
    markerNetId: string;
    annotation?: Annotation;
  },
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  if (!document.netlist)
    throw new Error(`Cell has no interface: ${documentId}`);
  if (
    input.instance.symbolId !== "port" &&
    input.instance.symbolId !== "port-filled"
  ) {
    throw new Error(
      `Cell interface marker must be a Port: ${input.instance.symbolId}`,
    );
  }
  const terminal = document.netlist.terminals.find(
    (candidate) => candidate.id === input.terminalId,
  );
  if (!terminal) {
    throw new Error(`Cell terminal does not exist: ${input.terminalId}`);
  }
  return [
    transactDocument(project, documentId, [
      { kind: "add_instance", instance: input.instance },
      ...input.connectionEdits,
      ...(input.markerNetId === terminal.netId
        ? []
        : [
            {
              kind: "merge_nets" as const,
              targetNetId: terminal.netId,
              sourceNetId: input.markerNetId,
            },
          ]),
      {
        kind: "update_cell_terminal",
        terminalId: terminal.id,
        interfaceInstanceIds: [
          ...terminal.interfaceInstanceIds,
          input.instance.id,
        ],
      },
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

export function proposeSetCellFormalParameters(
  project: CircuitProject,
  documentId: string,
  formalParameters: NonNullable<
    SchematicDocument["netlist"]
  >["formalParameters"],
): SubcircuitInterfaceProposal {
  const document = requireDocument(project, documentId);
  if (!document.netlist) {
    throw new Error(`Cell has no formal interface: ${documentId}`);
  }
  return interfaceProposal(project, { kind: "internal", id: documentId }, [
    transactDocument(project, documentId, [
      { kind: "set_cell_formal_parameters", formalParameters },
    ]),
  ]);
}

export function proposeUpsertExternalSubcircuitDefinition(
  project: CircuitProject,
  definition: ExternalSubcircuitDefinition,
): SubcircuitInterfaceProposal {
  const allowedPins = new Set(
    definition.terminals.map((terminal) => terminal.name.toLowerCase()),
  );
  const diagnostics = project.documents.flatMap((document) =>
    document.instances.flatMap((instance) => {
      const binding = instance.netlist?.binding;
      if (
        binding?.kind !== "external-subcircuit" ||
        binding.definitionId !== definition.id
      ) {
        return [];
      }
      const pins = new Set<string>();
      for (const net of document.nets) {
        for (const terminal of net.terminals) {
          if (terminal.instanceId === instance.id) pins.add(terminal.pinName);
        }
      }
      for (const route of document.routes) {
        for (const endpoint of [route.from, route.to]) {
          if (
            endpoint.kind === "terminal" &&
            endpoint.instanceId === instance.id
          ) {
            pins.add(endpoint.pinName);
          }
        }
      }
      return [...pins]
        .filter((pinName) => !allowedPins.has(pinName.toLowerCase()))
        .map(
          (pinName) =>
            `${document.id}.${instance.id} references removed external terminal ${pinName}`,
        );
    }),
  );
  return interfaceProposal(
    project,
    { kind: "external", id: definition.id },
    [
      {
        kind: "upsert_external_subcircuit_definition",
        definition,
      },
    ],
    diagnostics,
  );
}

/**
 * Rename one external terminal while retaining its stable identity and every
 * connected caller projection. Reordering is separately safe because callers
 * connect by terminal identity/name while netlist extraction observes array order.
 */
export function planRenameExternalSubcircuitTerminal(
  project: CircuitProject,
  definitionId: string,
  terminalId: string,
  newName: string,
): ProjectStructureEdit[] {
  const definition = project.externalSubcircuitDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  const terminal = definition?.terminals.find(
    (candidate) => candidate.id === terminalId,
  );
  if (!definition || !terminal) {
    throw new Error(
      `External terminal does not exist: ${definitionId}.${terminalId}`,
    );
  }
  if (
    definition.terminals.some(
      (candidate) =>
        candidate.id !== terminalId &&
        candidate.name.toLowerCase() === newName.toLowerCase(),
    )
  ) {
    throw new Error(`External terminal name already exists: ${newName}`);
  }
  if (terminal.name === newName) return [];
  const nextDefinition: ExternalSubcircuitDefinition = {
    ...definition,
    terminals: definition.terminals.map((candidate) =>
      candidate.id === terminalId ? { ...candidate, name: newName } : candidate,
    ),
  };
  const edits: ProjectStructureEdit[] = [
    {
      kind: "upsert_external_subcircuit_definition",
      definition: nextDefinition,
    },
  ];
  for (const document of project.documents) {
    const callerEdits: DocumentEdits = [];
    for (const instance of document.instances) {
      const binding = instance.netlist?.binding;
      if (
        binding?.kind !== "external-subcircuit" ||
        binding.definitionId !== definitionId
      ) {
        continue;
      }
      const referenced =
        document.nets.some((net) =>
          net.terminals.some(
            (reference) =>
              reference.instanceId === instance.id &&
              reference.pinName === terminal.name,
          ),
        ) ||
        document.routes.some((route) =>
          [route.from, route.to].some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              endpoint.instanceId === instance.id &&
              endpoint.pinName === terminal.name,
          ),
        ) ||
        document.noConnects.some(
          (noConnect) =>
            noConnect.endpoint.instanceId === instance.id &&
            noConnect.endpoint.pinName === terminal.name,
        ) ||
        (instance.importProvenance?.terminalMapping ?? []).some(
          (reference) => reference.pinName === terminal.name,
        );
      if (!referenced) continue;
      callerEdits.push({
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: externalSubcircuitSymbolId(definitionId),
        pinMap: { [terminal.name]: newName },
      });
    }
    if (callerEdits.length > 0)
      edits.push(transactDocument(project, document.id, callerEdits));
  }
  return edits;
}

export function planReorderExternalSubcircuitTerminal(
  project: CircuitProject,
  definitionId: string,
  terminalId: string,
  delta: -1 | 1,
): ProjectStructureEdit[] {
  const definition = project.externalSubcircuitDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition)
    throw new Error(`External subcircuit does not exist: ${definitionId}`);
  const index = definition.terminals.findIndex(
    (terminal) => terminal.id === terminalId,
  );
  const nextIndex = index + delta;
  if (index < 0)
    throw new Error(
      `External terminal does not exist: ${definitionId}.${terminalId}`,
    );
  if (nextIndex < 0 || nextIndex >= definition.terminals.length) return [];
  const terminals = [...definition.terminals];
  [terminals[index], terminals[nextIndex]] = [
    terminals[nextIndex]!,
    terminals[index]!,
  ];
  return [
    {
      kind: "upsert_external_subcircuit_definition",
      definition: { ...definition, terminals },
    },
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
    throw new Error("Cell Pin position must be a multiple of 10");
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
  const mergeTarget = child.netlist.terminals.find(
    (candidate) =>
      candidate.id !== terminalId &&
      candidate.name.toLowerCase() === newName.toLowerCase(),
  );
  if (mergeTarget) {
    const childEdits: DocumentEdits = [
      ...(terminal.netId === mergeTarget.netId
        ? []
        : [
            {
              kind: "merge_nets" as const,
              targetNetId: mergeTarget.netId,
              sourceNetId: terminal.netId,
            },
          ]),
      {
        kind: "update_cell_terminal",
        terminalId: mergeTarget.id,
        interfaceInstanceIds: [
          ...mergeTarget.interfaceInstanceIds,
          ...terminal.interfaceInstanceIds,
        ],
      },
      ...child.annotations
        .filter(
          (annotation) =>
            annotation.binding?.kind === "cell-terminal-name" &&
            annotation.binding.terminalId === terminal.id,
        )
        .map((annotation) => {
          const { formatOverride: _formatOverride, ...rest } = annotation;
          return {
            kind: "upsert_schematic_annotation" as const,
            annotation: {
              ...rest,
              binding: {
                kind: "cell-terminal-name" as const,
                terminalId: mergeTarget.id,
              },
            },
          };
        }),
      { kind: "remove_cell_terminal", terminalId: terminal.id },
    ];
    const edits: ProjectStructureEdit[] = [
      transactDocument(project, child.id, childEdits),
    ];
    for (const parent of project.documents) {
      const callerEdits: DocumentEdits = [];
      for (const instance of parent.instances) {
        const binding = instance.netlist?.binding;
        if (
          binding?.kind !== "subcircuit" ||
          binding.childDocumentId !== child.id
        ) {
          continue;
        }
        const sourceNet = parent.nets.find((net) =>
          net.terminals.some(
            (reference) =>
              reference.instanceId === instance.id &&
              reference.pinName === terminal.name,
          ),
        );
        const targetNet = parent.nets.find((net) =>
          net.terminals.some(
            (reference) =>
              reference.instanceId === instance.id &&
              reference.pinName === mergeTarget.name,
          ),
        );
        if (sourceNet && targetNet && sourceNet.id !== targetNet.id) {
          callerEdits.push({
            kind: "merge_nets",
            targetNetId: targetNet.id,
            sourceNetId: sourceNet.id,
          });
        }
        const sourceReferenced =
          sourceNet !== undefined ||
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
          (instance.importProvenance?.terminalMapping ?? []).some(
            (reference) => reference.pinName === terminal.name,
          );
        callerEdits.push({
          kind: "set_instance_symbol",
          instanceId: instance.id,
          symbolId: hierarchicalSymbolId(child.netlist.name),
          ...(sourceReferenced
            ? { pinMap: { [terminal.name]: mergeTarget.name } }
            : {}),
        });
      }
      if (callerEdits.length > 0) {
        edits.push(transactDocument(project, parent.id, callerEdits));
      }
    }
    return edits;
  }
  if (
    child.netlist.terminals.some(
      (candidate) => candidate.id !== terminalId && candidate.name === newName,
    )
  ) {
    // Renaming onto an existing interface name is ambiguous — it reads as
    // either "these are one pin" or a typo — and folding two formal terminals
    // together would silently rewrite the Cell interface every parent
    // Instance resolves against. Repeating a local Net name is the Net Label's
    // responsibility, not a second view of the same formal pin.
    throw new Error(
      `Cell terminal name already exists: ${newName}. Use a Net Label to repeat an internal Net name.`,
    );
  }

  const terminalRename = terminal.name !== newName;
  const annotationEdits = child.annotations
    .filter(
      (annotation) =>
        annotation.kind === "instance-label" &&
        annotation.anchor.kind === "object" &&
        terminal.interfaceInstanceIds.includes(annotation.anchor.objectId),
    )
    .flatMap((annotation) => {
      if (annotation.binding?.kind === "cell-terminal-name") {
        if (!terminalRename || !annotation.formatOverride) return [];
        const { formatOverride: _formatOverride, ...rest } = annotation;
        return [
          {
            kind: "upsert_schematic_annotation" as const,
            annotation: rest,
          },
        ];
      }
      const {
        content: _content,
        formatOverride: _formatOverride,
        ...rest
      } = annotation;
      return [
        {
          kind: "upsert_schematic_annotation" as const,
          annotation: {
            ...rest,
            binding: { kind: "cell-terminal-name" as const, terminalId },
          },
        },
      ];
    });
  if (!terminalRename && annotationEdits.length === 0) return [];

  const edits: ProjectStructureEdit[] = [
    {
      kind: "transact_document",
      documentId: child.id,
      expectedRevision: child.revision,
      edits: [
        ...(terminalRename
          ? [
              {
                kind: "update_cell_terminal" as const,
                terminalId,
                name: newName,
              },
            ]
          : []),
        ...annotationEdits,
      ],
    },
  ];
  if (!terminalRename) return edits;
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
        (instance.importProvenance?.terminalMapping ?? []).some(
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

/**
 * Applies a canvas Cell-Pin text edit atomically: the semantic character
 * change uses the hierarchy rename planner, while the same-text RichText
 * formatting remains on the bound annotation.
 */
export function planEditCellTerminalAnnotation(
  project: CircuitProject,
  documentId: string,
  terminalId: string,
  annotation: Annotation,
  newName: string,
): ProjectStructureEdit[] {
  const renameEdits = planRenameCellTerminal(
    project,
    documentId,
    terminalId,
    newName,
  );
  const annotationEdit = {
    kind: "upsert_schematic_annotation" as const,
    annotation,
  };
  const childEditIndex = renameEdits.findIndex(
    (edit) =>
      edit.kind === "transact_document" && edit.documentId === documentId,
  );
  if (childEditIndex < 0) {
    return [transactDocument(project, documentId, [annotationEdit])];
  }
  return renameEdits.map((edit, index) =>
    index === childEditIndex && edit.kind === "transact_document"
      ? { ...edit, edits: [...edit.edits, annotationEdit] }
      : edit,
  );
}

export function planExposePortInstance(
  project: CircuitProject,
  documentId: string,
  terminal: {
    id: string;
    name: string;
    netId: string;
    direction: "input" | "output" | "inout" | "passive";
    interfaceInstanceIds: string[];
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

export function planRemoveCellTerminalMarkers(
  project: CircuitProject,
  documentId: string,
  markerInstanceIds: readonly string[],
  instanceDeletionEdits: DocumentEdits,
): ProjectStructureEdit[] {
  const document = requireDocument(project, documentId);
  if (!document.netlist)
    throw new Error(`Cell has no interface: ${documentId}`);
  const selected = new Set(markerInstanceIds);
  if (selected.size === 0) return [];
  const matched = new Set<string>();
  const retainedTerminalEdits: DocumentEdits = [];
  const removedTerminalIds: string[] = [];
  for (const terminal of document.netlist.terminals) {
    const removed = terminal.interfaceInstanceIds.filter((instanceId) =>
      selected.has(instanceId),
    );
    if (removed.length === 0) continue;
    removed.forEach((instanceId) => matched.add(instanceId));
    const remaining = terminal.interfaceInstanceIds.filter(
      (instanceId) => !selected.has(instanceId),
    );
    if (remaining.length > 0) {
      retainedTerminalEdits.push({
        kind: "update_cell_terminal",
        terminalId: terminal.id,
        interfaceInstanceIds: remaining,
      });
    } else {
      removedTerminalIds.push(terminal.id);
    }
  }
  const unknown = [...selected].find((instanceId) => !matched.has(instanceId));
  if (unknown) {
    throw new Error(`Cell Pin marker does not exist: ${unknown}`);
  }
  if (removedTerminalIds.length === 0) {
    return [
      transactDocument(project, documentId, [
        ...retainedTerminalEdits,
        ...instanceDeletionEdits,
      ]),
    ];
  }
  return planRemoveCellTerminals(project, documentId, removedTerminalIds, [
    ...retainedTerminalEdits,
    ...instanceDeletionEdits,
  ]);
}

/**
 * Removes Cell Pins and detaches every child and caller wire to a Junction in
 * one Project transaction. Interface consistency is automatic; callers never
 * need to clear wires or NoConnect declarations by hand.
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
    return terminal;
  });
  const terminalInstanceIds = new Set(
    terminals.flatMap((terminal) => terminal.interfaceInstanceIds),
  );
  const resolver = createProjectSymbolResolver(project, builtInSymbols);
  const lifecycleEdits =
    instanceDeletionEdits ??
    planInstanceDeletion(
      document,
      resolver,
      [...terminalInstanceIds],
      project.structureRevision + 1,
    );
  const instanceRemovalEdits = lifecycleEdits.filter(
    (edit) => edit.kind === "remove_instance",
  );
  const edits: DocumentEdits = [
    ...lifecycleEdits.filter((edit) => edit.kind !== "remove_instance"),
    ...terminals.map((terminal) => ({
      kind: "remove_cell_terminal" as const,
      terminalId: terminal.id,
    })),
    ...instanceRemovalEdits,
  ];
  const callerDetachEdits: ProjectStructureEdit[] = [];
  const callerReconcileEdits: ProjectStructureEdit[] = [];
  for (const parent of project.documents) {
    const callers = parent.instances.filter((instance) => {
      const binding = instance.netlist?.binding;
      return (
        binding?.kind === "subcircuit" && binding.childDocumentId === documentId
      );
    });
    if (callers.length === 0) continue;
    const detachEdits = planTerminalDeletion(
      parent,
      resolver,
      callers.flatMap((instance) =>
        terminals.map((terminal) => ({
          instanceId: instance.id,
          pinName: terminal.name,
        })),
      ),
      project.structureRevision + 2,
    );
    const reconcileEdits: DocumentEdits = callers.map((instance) => ({
      kind: "set_instance_symbol",
      instanceId: instance.id,
      symbolId: instance.symbolId,
      ...(instance.symbolVariantId
        ? { symbolVariantId: instance.symbolVariantId }
        : {}),
    }));
    if (detachEdits.length > 0) {
      callerDetachEdits.push({
        kind: "transact_document",
        documentId: parent.id,
        expectedRevision: parent.revision,
        edits: detachEdits,
      });
      callerReconcileEdits.push({
        kind: "transact_document",
        documentId: parent.id,
        expectedRevision: parent.revision + 1,
        edits: reconcileEdits,
      });
    }
  }
  return [
    ...callerDetachEdits,
    {
      kind: "transact_document",
      documentId,
      expectedRevision: document.revision,
      edits,
    },
    ...callerReconcileEdits,
  ];
}
