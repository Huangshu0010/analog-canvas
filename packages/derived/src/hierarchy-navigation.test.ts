import { createEmptyProject } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildProjectConnectivityIndex } from "./connectivity-index.js";
import {
  findHierarchyPath,
  findHierarchyPaths,
} from "./hierarchy-navigation.js";

const dual = {
  schemaVersion: 1 as const,
  id: "dual",
  name: "Dual",
  viewBox: { x: -20, y: -20, width: 40, height: 40 },
  pins: [
    {
      name: "L",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west" as const,
      presentation: { visibility: "visible" as const },
    },
    {
      name: "R",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east" as const,
      presentation: { visibility: "visible" as const },
    },
  ],
  primitives: [],
  variants: [],
};

describe("hierarchy navigation", () => {
  it("finds stable paths through typed subcircuit bindings", () => {
    const project = createEmptyProject("project", "Project", "top");
    project.documents[0]!.instances = ["X2", "X1"].map((id) => ({
      id,
      symbolId: "dual",
      placement: null,
      properties: {},
      netlist: {
        reference: id,
        parameters: {},
        binding: {
          kind: "subcircuit" as const,
          name: "child",
          childDocumentId: "child",
        },
      },
    }));
    const child = createEmptyProject("child-project", "Child", "child")
      .documents[0]!;
    child.nets.push(
      { id: "child-l", scope: "local", terminals: [] },
      { id: "child-r", scope: "local", terminals: [] },
    );
    child.netlist = {
      name: "Child",
      terminals: [
        { name: "L", netId: "child-l" },
        { name: "R", netId: "child-r" },
      ],
    };
    project.documents.push(child);
    const index = buildProjectConnectivityIndex(
      project,
      new InMemorySymbolResolver([dual]),
    );

    expect(findHierarchyPath(index, "top", "child")).toEqual([
      { parentDocumentId: "top", instanceId: "X1", childDocumentId: "child" },
    ]);
    expect(findHierarchyPath(index, "top", "top")).toEqual([]);
    expect(findHierarchyPath(index, "top", "missing")).toBeUndefined();
    expect(findHierarchyPaths(index, "top", "child")).toHaveLength(2);
  });
});
