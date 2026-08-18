import { describe, expect, it } from "vitest";

import { createEmptyDocument, createEmptyProject } from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

import {
  planRemoveCellTerminal,
  planRenameCellTerminal,
  planSetCellSymbolPresentation,
} from "./hierarchy-planner.js";
import { executeProjectTransaction } from "./project-transaction.js";

function hierarchyInstance(
  id: string,
  cellName: string,
  childDocumentId: string,
) {
  return {
    id,
    symbolId: hierarchicalSymbolId(cellName),
    placement: {
      position: { x: 0, y: 0 },
      rotation: 0 as const,
      mirror: "none" as const,
    },
    properties: {},
    netlist: {
      reference: id,
      parameters: {},
      binding: {
        kind: "subcircuit" as const,
        name: cellName,
        childDocumentId,
      },
    },
  };
}

describe("Project structural transaction", () => {
  it("renames a Cell and reconciles every caller binding", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    project.documents.push(child);
    project.documents[0]!.instances.push(
      hierarchyInstance("X1", "Child", child.id),
    );

    const result = executeProjectTransaction(project, {
      transactionId: "rename-child",
      projectId: project.id,
      expectedStructureRevision: project.structureRevision,
      actor: { kind: "human", id: "human-local" },
      edits: [{ kind: "rename_document", documentId: child.id, name: "Stage" }],
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      project: {
        documents: [
          {
            instances: [
              {
                symbolId: hierarchicalSymbolId("Stage"),
                netlist: { binding: { name: "Stage" } },
              },
            ],
          },
          { name: "Stage", netlist: { name: "Stage" } },
        ],
      },
    });
  });

  it("atomically creates a child Cell and its parent Instance", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    const result = executeProjectTransaction(project, {
      transactionId: "create-child",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "human-local" },
      edits: [
        { kind: "add_document", document: child },
        {
          kind: "transact_document",
          documentId: project.topDocumentId,
          expectedRevision: 0,
          edits: [
            {
              kind: "add_instance",
              instance: hierarchyInstance("X1", "Child", child.id),
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      structureRevision: 1,
      changedDocumentIds: ["document-child", "document-main"],
      project: {
        structureRevision: 1,
        documents: [
          { id: "document-main", revision: 1, instances: [{ id: "X1" }] },
          { id: "document-child", revision: 0 },
        ],
      },
    });
    expect(project.documents).toHaveLength(1);
    expect(project.structureRevision).toBe(0);
  });

  it("returns a complete proposed Project from dry-run without mutation", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    const result = executeProjectTransaction(project, {
      transactionId: "dry-create-child",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "agent", id: "agent" },
      dryRun: true,
      edits: [{ kind: "add_document", document: child }],
    });

    expect(result).toMatchObject({
      ok: true,
      applied: false,
      structureRevision: 0,
      proposedStructureRevision: 1,
      project: { documents: [{ id: "document-main" }] },
      proposedProject: {
        structureRevision: 1,
        documents: [{ id: "document-main" }, { id: "document-child" }],
      },
    });
  });

  it("rejects stale revisions and referenced or top Cell deletion", () => {
    const project = createEmptyProject("project", "Project");
    expect(
      executeProjectTransaction(project, {
        transactionId: "stale",
        projectId: project.id,
        expectedStructureRevision: 1,
        actor: { kind: "human", id: "human-local" },
        edits: [{ kind: "remove_document", documentId: project.topDocumentId }],
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "STALE_STRUCTURE_REVISION" },
    });

    expect(
      executeProjectTransaction(project, {
        transactionId: "delete-top",
        projectId: project.id,
        expectedStructureRevision: 0,
        actor: { kind: "human", id: "human-local" },
        edits: [{ kind: "remove_document", documentId: project.topDocumentId }],
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "EDIT_PRECONDITION" },
    });
  });

  it("removes an Instance before deleting its now-unreferenced Cell", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    project.documents.push(child);
    project.documents[0]!.instances.push(
      hierarchyInstance("X1", "Child", child.id),
    );
    const result = executeProjectTransaction(project, {
      transactionId: "delete-child",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "human-local" },
      edits: [
        {
          kind: "transact_document",
          documentId: project.topDocumentId,
          expectedRevision: 0,
          edits: [{ kind: "remove_instance", instanceId: "X1" }],
        },
        { kind: "remove_document", documentId: child.id },
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      project: { documents: [{ id: "document-main", instances: [] }] },
    });
  });

  it("rejects a final cyclic Project without exposing partial edits", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    child.instances.push(
      hierarchyInstance("XBACK", "Main", project.topDocumentId),
    );
    const result = executeProjectTransaction(project, {
      transactionId: "cycle",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "human-local" },
      edits: [
        { kind: "add_document", document: child },
        {
          kind: "transact_document",
          documentId: project.topDocumentId,
          expectedRevision: 0,
          edits: [
            {
              kind: "add_instance",
              instance: hierarchyInstance("X1", "Child", child.id),
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESULT" },
      project: { documents: [{ id: "document-main", instances: [] }] },
    });
    expect(result.diagnostics[0]?.message).toMatch(/Hierarchy cycle/);
  });

  it("renames a formal port and every connected caller atomically", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    child.instances.push({
      id: "port-in",
      symbolId: "port",
      placement: null,
      properties: {},
    });
    child.nets.push({
      id: "net-in",
      scope: "local",
      terminals: [{ instanceId: "port-in", pinName: "P" }],
    });
    child.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceId: "port-in",
    });
    project.documents.push(child);
    const caller = {
      ...hierarchyInstance("X1", "Child", child.id),
      netlist: {
        ...hierarchyInstance("X1", "Child", child.id).netlist,
        terminals: [{ sourcePosition: 0, pinName: "IN" }],
      },
    };
    project.documents[0]!.instances.push(caller);
    project.documents[0]!.nets.push({
      id: "net-parent",
      scope: "local",
      terminals: [{ instanceId: "X1", pinName: "IN" }],
    });

    const result = executeProjectTransaction(project, {
      transactionId: "rename-port",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "human-local" },
      edits: planRenameCellTerminal(project, child.id, "terminal-in", "VIN"),
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      project: {
        documents: [
          {
            id: "document-main",
            nets: [{ terminals: [{ instanceId: "X1", pinName: "VIN" }] }],
            instances: [{ netlist: { terminals: [{ pinName: "VIN" }] } }],
          },
          {
            id: "document-child",
            netlist: { terminals: [{ id: "terminal-in", name: "VIN" }] },
          },
        ],
      },
    });
  });

  it("removes an unused formal port and reconciles caller source order", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    child.instances.push({
      id: "port-unused",
      symbolId: "port",
      placement: null,
      properties: {},
    });
    child.nets.push({
      id: "net-unused",
      scope: "local",
      terminals: [{ instanceId: "port-unused", pinName: "P" }],
    });
    child.netlist!.terminals.push({
      id: "terminal-unused",
      name: "UNUSED",
      netId: "net-unused",
      direction: "passive",
      interfaceInstanceId: "port-unused",
    });
    project.documents.push(child);
    project.documents[0]!.instances.push({
      ...hierarchyInstance("X1", "Child", child.id),
      netlist: {
        ...hierarchyInstance("X1", "Child", child.id).netlist,
        terminals: [{ sourcePosition: 0, pinName: "UNUSED" }],
      },
    });

    const result = executeProjectTransaction(project, {
      transactionId: "remove-unused-port",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "human-local" },
      edits: planRemoveCellTerminal(project, child.id, "terminal-unused"),
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      project: {
        documents: [
          { instances: [{ netlist: { terminals: [] } }] },
          { instances: [], netlist: { terminals: [] } },
        ],
      },
    });
  });

  it("updates Cell symbol intent only through a structural transaction", () => {
    const project = createEmptyProject("project", "Project");
    const result = executeProjectTransaction(project, {
      transactionId: "set-cell-symbol-presentation",
      projectId: project.id,
      expectedStructureRevision: project.structureRevision,
      actor: { kind: "human", id: "human-local" },
      edits: planSetCellSymbolPresentation(project, project.topDocumentId, {
        minimumBodySize: { width: 120, height: 80 },
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      project: {
        structureRevision: 1,
        documents: [
          {
            revision: 1,
            presentation: {
              cellSymbol: { minimumBodySize: { width: 120, height: 80 } },
            },
          },
        ],
      },
    });
  });

  it("follows caller Route geometry when a definition pin moves", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("document-child", "Child");
    child.instances.push({
      id: "P1",
      symbolId: "port",
      placement: null,
      properties: {},
    });
    child.nets.push({
      id: "net-in",
      scope: "local",
      terminals: [{ instanceId: "P1", pinName: "P" }],
    });
    child.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceId: "P1",
    });
    project.documents.push(child);
    const parent = project.documents[0]!;
    parent.instances.push({
      ...hierarchyInstance("X1", "Child", child.id),
      netlist: {
        ...hierarchyInstance("X1", "Child", child.id).netlist,
        terminals: [{ sourcePosition: 0, pinName: "IN" }],
      },
    });
    parent.nets.push({
      id: "net-parent",
      scope: "local",
      terminals: [{ instanceId: "X1", pinName: "IN" }],
    });
    parent.junctions.push({
      id: "J1",
      netId: "net-parent",
      position: { x: -150, y: 0 },
    });
    parent.routes.push({
      id: "route-input",
      netId: "net-parent",
      from: { kind: "terminal", instanceId: "X1", pinName: "IN" },
      to: { kind: "junction", junctionId: "J1" },
      waypoints: [],
      segmentModes: ["auto"],
    });

    const result = executeProjectTransaction(project, {
      transactionId: "move-child-input-pin",
      projectId: project.id,
      expectedStructureRevision: project.structureRevision,
      actor: { kind: "human", id: "human-local" },
      edits: planSetCellSymbolPresentation(project, child.id, {
        pinPlacements: [
          { terminalId: "terminal-in", side: "north", offset: 0 },
        ],
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      changedDocumentIds: ["document-child", "document-main"],
      project: {
        documents: [
          {
            routes: [
              {
                id: "route-input",
                waypoints: [{ x: -150, y: -30 }],
                segmentModes: ["auto", "auto"],
              },
            ],
          },
          {},
        ],
      },
    });
  });
});
