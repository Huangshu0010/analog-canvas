import { createEmptyProject, type CircuitProject } from "@icm/model";
import { describe, expect, it } from "vitest";

import { buildProjectSearchIndex } from "./index.js";

function searchProject(): CircuitProject {
  const project = createEmptyProject("s", "S", "doc");
  const document = project.documents[0]!;
  document.instances = [
    {
      id: "M1",
      symbolId: "nmos",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: { "spice.name": "M1", "spice.target": "nmos_rf", W: 10 },
    },
    {
      id: "Rdrive",
      symbolId: "resistor",
      placement: { position: { x: 100, y: 0 }, rotation: 0, mirror: "none" },
      properties: { "spice.name": "Rload", R: "1k" },
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

  it("matches spice.name and uses it as the instance label", () => {
    const results = buildProjectSearchIndex(searchProject()).search("rload");
    const drive = results.find(
      (result) => result.locator.objectId === "Rdrive",
    );
    expect(drive?.field).toBe("spice-name");
    expect(drive?.label).toBe("Rload");
  });

  it("produces a deterministic ordering", () => {
    const a = buildProjectSearchIndex(searchProject()).search("e");
    const b = buildProjectSearchIndex(searchProject()).search("e");
    expect(a).toEqual(b);
  });
});
