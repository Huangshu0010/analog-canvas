import type { CircuitProject } from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

import type { ProjectStructureEdit } from "./project-transaction.js";

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
      edits: [{ kind: "update_cell_terminal", terminalId, name: newName }],
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
): ProjectStructureEdit[] {
  const document = project.documents.find((item) => item.id === documentId);
  const terminal = document?.netlist?.terminals.find(
    (item) => item.id === terminalId,
  );
  if (!document || !terminal) {
    throw new Error(
      `Cell terminal does not exist: ${documentId}.${terminalId}`,
    );
  }
  const caller = project.documents
    .flatMap((parent) =>
      parent.instances.map((instance) => ({ parent, instance })),
    )
    .find(({ parent, instance }) => {
      const binding = instance.netlist?.binding;
      if (
        binding?.kind !== "subcircuit" ||
        binding.childDocumentId !== documentId
      )
        return false;
      return documentElectricallyReferencesPin(
        parent,
        instance.id,
        terminal.name,
      );
    });
  if (caller) {
    throw new Error(
      `Cell terminal ${terminal.name} is still referenced by ${caller.parent.id}.${caller.instance.id}`,
    );
  }
  const edits: Extract<
    ProjectStructureEdit,
    { kind: "transact_document" }
  >["edits"] = [];
  if (
    document.routes.some((route) =>
      [route.from, route.to].some(
        (endpoint) =>
          endpoint.kind === "terminal" &&
          endpoint.instanceId === terminal.interfaceInstanceId,
      ),
    )
  ) {
    throw new Error(
      `Remove wire geometry from Cell terminal ${terminal.name} before deleting it`,
    );
  }
  for (const noConnect of document.noConnects) {
    if (noConnect.endpoint.instanceId === terminal.interfaceInstanceId) {
      edits.push({ kind: "remove_no_connect", noConnectId: noConnect.id });
    }
  }
  if (
    document.nets.some((net) =>
      net.terminals.some(
        (reference) =>
          reference.instanceId === terminal.interfaceInstanceId &&
          reference.pinName === "P",
      ),
    )
  ) {
    edits.push({
      kind: "disconnect_endpoint",
      endpoint: {
        kind: "terminal",
        instanceId: terminal.interfaceInstanceId,
        pinName: "P",
      },
    });
  }
  edits.push(
    { kind: "remove_cell_terminal", terminalId },
    { kind: "remove_instance", instanceId: terminal.interfaceInstanceId },
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
        !instance.netlist?.terminals?.some(
          (reference) => reference.pinName === terminal.name,
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
            .filter((reference) => reference.pinName !== terminal.name)
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
