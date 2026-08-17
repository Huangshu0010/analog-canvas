import { createEmptyDocument, createEmptyProject } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildProjectConnectivityIndex } from "./connectivity-index.js";
import { traceHierarchyNet } from "./net-highlight.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("Net highlight", () => {
  it("groups equal global Net names across Cells without merging local Net objects", () => {
    const project = createEmptyProject("project", "Project", "top");
    project.documents[0]!.id = "top";
    project.documents[0]!.nets.push({
      id: "net-vdd-top",
      name: "VDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });
    const child = createEmptyDocument("child", "Child");
    child.nets.push({
      id: "net-vdd-child",
      name: "vdd",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });
    project.documents.push(child);

    const index = buildProjectConnectivityIndex(project, resolver);

    expect(index.globalNets.get("vdd")).toEqual({
      foldedName: "vdd",
      nets: [
        { documentId: "child", netId: "net-vdd-child" },
        { documentId: "top", netId: "net-vdd-top" },
      ],
    });
    const trace = traceHierarchyNet(index, "top", "net-vdd-top");
    expect(
      trace?.highlights.map((item) => [item.documentId, item.netId]),
    ).toEqual([
      ["child", "net-vdd-child"],
      ["top", "net-vdd-top"],
    ]);
    expect(trace?.hops).toContainEqual({
      direction: "global",
      from: { documentId: "top", netId: "net-vdd-top" },
      to: { documentId: "child", netId: "net-vdd-child" },
      foldedName: "vdd",
    });
  });
});
