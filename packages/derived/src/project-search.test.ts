import { createEmptyProject, type CircuitProject } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  buildProjectConnectivityIndex,
  buildProjectSearchIndex,
} from "./index.js";

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
  ],
  primitives: [],
  variants: [],
  aliases: [],
};

function searchProject(): CircuitProject {
  const project = createEmptyProject("s", "S", "doc");
  const document = project.documents[0]!;
  document.instances = [
    {
      id: "M1",
      symbolId: "nmos",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: { W: 10, target: "nmos_rf" },
      netlist: { reference: "M1", parameters: {} },
    },
    {
      id: "Rdrive",
      symbolId: "resistor",
      placement: { position: { x: 100, y: 0 }, rotation: 0, mirror: "none" },
      properties: { R: "1k" },
      netlist: { reference: "Rload", parameters: {} },
    },
  ];
  document.nets = [
    { id: "net-in", name: "VIN", scope: "local", terminals: [], ports: [] },
    { id: "net-out", name: "vout", scope: "local", terminals: [], ports: [] },
  ];
  document.ports = [
    { id: "port-in", name: "IN", direction: "input", position: { x: 0, y: 0 } },
  ];
  return project;
}

function multiCallerSearchProject(): CircuitProject {
  const project = createEmptyProject("multi", "Multi", "top");
  const top = project.documents[0]!;
  top.instances = ["X1", "X2"].map((id) => ({
    id,
    symbolId: "dual",
    placement: null,
    properties: {},
    netlist: {
      reference: id,
      parameters: {},
      binding: { kind: "subcircuit", name: "child", childDocumentId: "child" },
    },
  }));
  const child = createEmptyProject("child-project", "Child", "child")
    .documents[0]!;
  child.ports = [
    { id: "child-l", name: "L", direction: "passive", position: null },
  ];
  child.instances = [
    {
      id: "RCHILD",
      symbolId: "resistor",
      placement: null,
      properties: {},
      netlist: { reference: "RCHILD", parameters: {} },
    },
  ];
  project.documents.push(child);
  return project;
}

describe("buildProjectSearchIndex", () => {
  it("returns nothing for an empty query", () => {
    expect(buildProjectSearchIndex(searchProject()).search("   ")).toEqual([]);
  });

  it("matches case-insensitively across instance, net, and port fields", () => {
    const results = buildProjectSearchIndex(searchProject()).search("vin");
    const ids = results.map((result) => result.locator.objectId);
    expect(ids).toContain("net-in"); // net name "VIN" substring
    expect(
      results.find((result) => result.locator.objectId === "net-in")?.locator,
    ).toMatchObject({ documentId: "doc", hierarchyPath: [], kind: "net" });
  });

  it("ranks exact above prefix above substring, per object", () => {
    // Query "M1": exact on instance-id "M1" and spice.name "M1"; the instance
    // should appear once with the exact match.
    const results = buildProjectSearchIndex(searchProject()).search("M1");
    const m1 = results.find((result) => result.locator.objectId === "M1");
    expect(m1?.matchType).toBe("exact");
  });

  it("prefix outranks substring for the same object", () => {
    // "net-o" is a prefix of net-id "net-out"; net name "vout" does not match.
    const results = buildProjectSearchIndex(searchProject()).search("net-o");
    const out = results.find((result) => result.locator.objectId === "net-out");
    expect(out?.matchType).toBe("prefix");
    expect(out?.field).toBe("net-id");
  });

  it("matches a property value and reports the property field", () => {
    const results = buildProjectSearchIndex(searchProject()).search("1k");
    const drive = results.find(
      (result) => result.locator.objectId === "Rdrive",
    );
    expect(drive?.field).toBe("property");
    expect(drive?.label).toBe("R=1k");
  });

  it("matches a property key as well as its value", () => {
    const result = buildProjectSearchIndex(searchProject())
      .search("target")
      .find((candidate) => candidate.locator.objectId === "M1");
    expect(result?.field).toBe("property");
    expect(result?.label).toBe("target=nmos_rf");
  });

  it("uses the supplied connectivity object index for canonical locators", () => {
    const project = searchProject();
    const connectivityIndex = buildProjectConnectivityIndex(
      project,
      new InMemorySymbolResolver([]),
    );
    let resolves = 0;
    const indexedSearch = buildProjectSearchIndex(project, {
      connectivityIndex: {
        ...connectivityIndex,
        objectIndex: {
          resolve(documentId, objectId) {
            resolves += 1;
            return connectivityIndex.objectIndex.resolve(documentId, objectId);
          },
        },
      },
    });
    const result = indexedSearch
      .search("vin")
      .find((candidate) => candidate.locator.objectId === "net-in");
    expect(resolves).toBeGreaterThan(0);
    expect(result?.locator).toStrictEqual(
      connectivityIndex.objectIndex.resolve("doc", "net-in"),
    );
  });

  it("expands a reused child object into one result for every caller path", () => {
    const project = multiCallerSearchProject();
    const connectivityIndex = buildProjectConnectivityIndex(
      project,
      new InMemorySymbolResolver([dual]),
    );
    const results = buildProjectSearchIndex(project, { connectivityIndex })
      .search("rchild")
      .filter((result) => result.locator.objectId === "RCHILD");
    expect(results).toHaveLength(2);
    expect(
      results.map((result) =>
        result.locator.hierarchyPath.map((frame) => frame.instanceId),
      ),
    ).toEqual([["X1"], ["X2"]]);
  });

  it("matches netlist reference and uses it as the instance label", () => {
    const results = buildProjectSearchIndex(searchProject()).search("rload");
    const drive = results.find(
      (result) => result.locator.objectId === "Rdrive",
    );
    expect(drive?.field).toBe("netlist-reference");
    expect(drive?.label).toBe("Rload");
  });

  it("produces a deterministic ordering", () => {
    const a = buildProjectSearchIndex(searchProject()).search("e");
    const b = buildProjectSearchIndex(searchProject()).search("e");
    expect(a).toEqual(b);
  });
});
