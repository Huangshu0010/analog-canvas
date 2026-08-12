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
  aliases: [],
};

describe("hierarchy navigation", () => {
  it("returns a stable concrete instance path to a child Cell", () => {
    const project = createEmptyProject("project", "Project", "top");
    project.documents[0]!.instances = [
      {
        id: "X2",
        symbolId: "dual",
        placement: null,
        properties: { "spice.childDocumentId": "child" },
      },
      {
        id: "X1",
        symbolId: "dual",
        placement: null,
        properties: { "spice.childDocumentId": "child" },
      },
    ];
    const child = createEmptyProject("child-project", "Child", "child")
      .documents[0]!;
    child.ports = [
      { id: "child-l", name: "L", direction: "passive", position: null },
      { id: "child-r", name: "R", direction: "passive", position: null },
    ];
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
    expect(findHierarchyPaths(index, "top", "child")).toEqual([
      [{ parentDocumentId: "top", instanceId: "X1", childDocumentId: "child" }],
      [{ parentDocumentId: "top", instanceId: "X2", childDocumentId: "child" }],
    ]);
  });
});
