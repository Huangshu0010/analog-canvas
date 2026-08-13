import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import { CircuitProjectJsonSchema, CircuitProjectSchema } from "./schema.js";

describe("CircuitProject schema", () => {
  it("accepts a minimal Project with one Document", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(CircuitProjectSchema.parse(project)).toEqual(project);
    expect(CircuitProjectJsonSchema).toMatchObject({ type: "object" });
  });

  it("uses Razavi textbook presentation for a new Project", () => {
    const project = createEmptyProject("project-style", "Style");

    expect(project.documents[0]!.presentation.styleProfileId).toBe(
      "razavi-textbook-v1",
    );
  });

  it("rejects a missing top Document", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(() =>
      CircuitProjectSchema.parse({
        ...project,
        topDocumentId: "document-missing",
      }),
    ).toThrow(/Unknown top document/);
  });

  it("validates persisted Cell interface and reference uniqueness", () => {
    const project = createEmptyProject("project-netlist", "Netlist Project");
    const document = project.documents[0]!;
    document.ports.push({
      id: "port-in",
      name: "IN",
      direction: "input",
      position: null,
    });
    document.netlist!.portOrder.push("port-in");
    document.instances.push(
      {
        id: "r-a",
        symbolId: "resistor",
        placement: null,
        properties: {},
        netlist: {
          reference: "R1",
          binding: { kind: "primitive", deviceClass: "resistor" },
          parameters: { value: "10k" },
        },
      },
      {
        id: "r-b",
        symbolId: "resistor",
        placement: null,
        properties: {},
        netlist: {
          reference: "r1",
          binding: { kind: "primitive", deviceClass: "resistor" },
          parameters: { value: "20k" },
        },
      },
    );

    const duplicate = CircuitProjectSchema.safeParse(project);
    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.message).toContain(
        "Duplicate netlist instance reference",
      );
    }

    document.instances[1]!.netlist!.reference = "R2";
    document.netlist!.portOrder = [];
    const missingPort = CircuitProjectSchema.safeParse(project);
    expect(missingPort.success).toBe(false);
    if (!missingPort.success) {
      expect(missingPort.error.message).toContain(
        "Port is absent from the netlist interface",
      );
    }
  });

  it("rejects geometry-only crossings as implicit connectivity data", () => {
    const project = createEmptyProject("project-test", "Test Project");
    const [document] = project.documents;
    expect(
      CircuitProjectSchema.safeParse({
        ...project,
        documents: [{ ...document, geometricConnections: [] }],
      }).success,
    ).toBe(false);
  });

  it("validates route-marker annotations with a markerKind and route VisualAnchor", () => {
    const project = createEmptyProject("project-marker", "Marker");
    const document = project.documents[0]!;
    document.annotations.push({
      id: "marker-1",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      position: { x: 20, y: 20 },
      anchor: {
        kind: "route",
        routeId: "route-1",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -14,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 20, y: 20 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    // markerKind is only valid on a route-marker annotation.
    document.annotations[0] = {
      ...document.annotations[0]!,
      kind: "instance-label",
    };
    expect(CircuitProjectSchema.safeParse(project).success).toBe(false);
  });

  it("rejects terminal and port membership in multiple logical Nets", () => {
    const project = createEmptyProject("project-test", "Test Project");
    const document = project.documents[0]!;
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      placement: null,
      properties: {},
    });
    document.ports.push({
      id: "port-out",
      name: "OUT",
      direction: "output",
      position: null,
    });
    document.nets.push(
      {
        id: "net-a",
        scope: "local",
        terminals: [{ instanceId: "M1", pinName: "D" }],
        ports: ["port-out"],
      },
      {
        id: "net-b",
        scope: "local",
        terminals: [{ instanceId: "M1", pinName: "D" }],
        ports: ["port-out"],
      },
    );

    const result = CircuitProjectSchema.safeParse(project);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toMatch(/Terminal belongs to multiple nets/);
    expect(result.error.message).toMatch(/Port belongs to multiple nets/);
  });
});
