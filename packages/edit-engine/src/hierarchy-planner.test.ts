import { describe, expect, it } from "vitest";

import { createEmptyDocument, createEmptyProject } from "@icm/model";

import {
  createHierarchyInstance,
  planCreateCellPort,
  planPlaceCellInstance,
  planReorderCellTerminal,
} from "./hierarchy-planner.js";
import { executeProjectTransaction } from "./project-transaction.js";

describe("hierarchy domain planners", () => {
  it("constructs one canonical caller from the child interface", () => {
    const child = createEmptyDocument("child", "Stage");
    child.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceIds: ["P1"],
    });

    expect(
      createHierarchyInstance("X1", child, {
        position: { x: 100, y: 80 },
        rotation: 90,
        mirror: "x",
      }),
    ).toMatchObject({
      id: "X1",
      placement: { rotation: 90, mirror: "x" },
      netlist: {
        reference: "X1",
        binding: { childDocumentId: "child" },
      },
    });
  });

  it("places a Cell caller through one parent transaction", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("child", "Stage");
    project.documents.push(child);
    const instance = createHierarchyInstance("X1", child, {
      position: { x: 0, y: 0 },
      rotation: 0,
      mirror: "none",
    });
    const result = executeProjectTransaction(project, {
      transactionId: "place-cell",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "test" },
      edits: planPlaceCellInstance(project, project.topDocumentId, instance),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.documents.find(
        (document) => document.id === project.topDocumentId,
      )?.instances,
    ).toEqual([expect.objectContaining({ id: "X1" })]);
  });

  it("permits a hierarchy reference independent from the stable instance id", () => {
    const child = createEmptyDocument("child", "Stage");
    expect(
      createHierarchyInstance(
        "X2-copy-1",
        child,
        { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
        "X2",
      ),
    ).toMatchObject({ id: "X2-copy-1", netlist: { reference: "X2" } });
  });

  it("atomically adds a Port Instance, local Net, and formal terminal", () => {
    const project = createEmptyProject("project", "Project");
    const instance = {
      id: "P1",
      symbolId: "port",
      placement: {
        position: { x: 40, y: 20 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
    };
    const result = executeProjectTransaction(project, {
      transactionId: "add-port",
      projectId: project.id,
      expectedStructureRevision: 0,
      actor: { kind: "human", id: "test" },
      edits: planCreateCellPort(project, project.topDocumentId, {
        instance,
        connectionEdits: [
          {
            kind: "connect_endpoints",
            from: { kind: "terminal", instanceId: "P1", pinName: "P" },
            to: { kind: "terminal", instanceId: "P1", pinName: "P" },
            newNetId: "net-in",
          },
        ],
        terminal: {
          id: "terminal-in",
          name: "IN",
          netId: "net-in",
          direction: "input",
          interfaceInstanceIds: ["P1"],
        },
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      project: {
        documents: [
          {
            instances: [{ id: "P1" }],
            nets: [{ id: "net-in", terminals: [{ instanceId: "P1" }] }],
            netlist: { terminals: [{ id: "terminal-in", name: "IN" }] },
          },
        ],
      },
    });
  });

  it("returns no reorder transaction at an interface boundary", () => {
    const project = createEmptyProject("project", "Project");
    project.documents[0]!.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceIds: ["P1"],
    });
    expect(
      planReorderCellTerminal(
        project,
        project.topDocumentId,
        "terminal-in",
        -1,
      ),
    ).toEqual([]);
  });
});
