import { describe, expect, it } from "vitest";

import { createEmptyDocument, createEmptyProject } from "./factories.js";
import {
  AnnotationSchema,
  CircuitProjectJsonSchema,
  CircuitProjectSchema,
  SchematicDocumentSchema,
} from "./schema.js";

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

  it("rejects a persisted page point that is not aligned to its Document grid", () => {
    const document = createEmptyProject("project-grid", "Grid").documents[0]!;
    document.drafting!.objects.push({
      id: "draft-off-grid",
      kind: "text",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 15, y: 20 } },
      content: { runs: [{ kind: "text", value: "off grid" }] },
      alignment: "start",
      rotation: 0,
    });

    const result = SchematicDocumentSchema.safeParse(document);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["drafting", "objects", 0, "anchor", "position", "x"],
      }),
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

  it("requires every hierarchy target to exist and rejects cycles", () => {
    const project = createEmptyProject("project-hierarchy", "Hierarchy");
    const parent = project.documents[0]!;
    const child = createEmptyDocument("document-child", "Child");
    project.documents.push(child);
    parent.instances.push({
      id: "X1",
      symbolId: "hierarchical-child",
      placement: null,
      properties: {},
      netlist: {
        reference: "X1",
        parameters: {},
        binding: {
          kind: "subcircuit",
          name: "Child",
          childDocumentId: child.id,
        },
      },
    });
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);

    parent.nets.push({
      id: "net-parent",
      scope: "local",
      terminals: [{ instanceId: "X1", pinName: "MISSING" }],
    });
    expect(() => CircuitProjectSchema.parse(project)).toThrow(
      /unknown child terminal MISSING/,
    );
    parent.nets = [];

    child.instances.push({
      id: "XBACK",
      symbolId: "hierarchical-main",
      placement: null,
      properties: {},
      netlist: {
        reference: "XBACK",
        parameters: {},
        binding: {
          kind: "subcircuit",
          name: "Main",
          childDocumentId: parent.id,
        },
      },
    });
    expect(() => CircuitProjectSchema.parse(project)).toThrow(
      /Hierarchy cycle/,
    );

    child.instances[0]!.netlist!.binding = {
      kind: "subcircuit",
      name: "Missing",
      childDocumentId: "document-missing",
    };
    expect(() => CircuitProjectSchema.parse(project)).toThrow(
      /unknown Document/,
    );
  });

  it("binds a formal Cell terminal to an ordinary Port Instance and Net", () => {
    const project = createEmptyProject("project-port", "Formal port");
    const document = project.documents[0]!;
    document.instances.push({
      id: "P1",
      symbolId: "port",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: {},
    });
    document.nets.push({
      id: "net-input",
      name: "VIN",
      scope: "local",
      terminals: [{ instanceId: "P1", pinName: "P" }],
    });
    document.netlist!.terminals.push({
      id: "cell-terminal-vin",
      name: "VIN",
      netId: "net-input",
      direction: "input",
      interfaceInstanceId: "P1",
    });
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);

    document.nets[0]!.terminals = [];
    expect(() => CircuitProjectSchema.parse(project)).toThrow(
      /is not connected to Net/,
    );
  });

  it("rejects every removed first-class Port shape", () => {
    const project = createEmptyProject("project-port", "Port contract");
    const document = project.documents[0]!;
    expect(
      CircuitProjectSchema.safeParse({
        ...project,
        documents: [{ ...document, ports: [] }],
      }).success,
    ).toBe(false);
    expect(
      CircuitProjectSchema.safeParse({
        ...project,
        documents: [
          {
            ...document,
            nets: [
              {
                id: "net",
                scope: "local",
                terminals: [],
                ports: [],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
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
      content: { runs: [{ kind: "text", value: "I_x" }] },
      anchor: {
        kind: "free",
        position: { x: 20, y: 20 },
      },
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
  it("accepts an instance-value annotation without a Net relation", () => {
    const project = createEmptyProject("project-value", "Value");
    const document = project.documents[0]!;
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      properties: {},
    });
    const value = {
      id: "instance-value-R1",
      kind: "instance-value" as const,
      content: { runs: [{ kind: "text" as const, value: "10k" }] },
      anchor: {
        kind: "object" as const,
        objectId: "R1",
        localOffset: { x: 40, y: 0 },
        fallbackPosition: { x: 140, y: 100 },
      },
      alignment: "start" as const,
      rotation: 0 as const,
      locked: false,
    };
    document.annotations.push(value);
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    // instance-value is not a Net-bound kind.
    expect(
      AnnotationSchema.safeParse({ ...value, netId: "net-1" }).success,
    ).toBe(false);
  });
  it("accepts an optional presentation-only visible flag on annotations", () => {
    const project = createEmptyProject("project-visible", "Visible");
    const document = project.documents[0]!;
    const label = {
      id: "label-1",
      kind: "instance-label" as const,
      content: { runs: [{ kind: "text" as const, value: "R1" }] },
      anchor: { kind: "free" as const, position: { x: 20, y: 20 } },
      alignment: "middle" as const,
      rotation: 0 as const,
      locked: false,
    };
    document.annotations.push(label);
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    document.annotations[0] = { ...label, visible: false };
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    document.annotations[0] = { ...label, visible: true };
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
  });

  it("validates definition-level Cell symbol placement against stable formal terminals", () => {
    const project = createEmptyProject("project-cell-symbol", "Cell symbol");
    const document = project.documents[0]!;
    document.instances.push({
      id: "P1",
      symbolId: "port",
      placement: null,
      properties: {},
    });
    document.nets.push({
      id: "net-input",
      name: "VIN",
      scope: "local",
      terminals: [{ instanceId: "P1", pinName: "P" }],
    });
    document.netlist!.terminals.push({
      id: "terminal-input",
      name: "VIN",
      netId: "net-input",
      direction: "input",
      interfaceInstanceId: "P1",
    });
    document.presentation.cellSymbol = {
      minimumBodySize: { width: 100, height: 60 },
      pinPlacements: [
        { terminalId: "terminal-input", side: "north", offset: 20 },
      ],
    };
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);

    document.presentation.cellSymbol.pinPlacements = [
      { terminalId: "missing-terminal", side: "north", offset: 20 },
    ];
    expect(CircuitProjectSchema.safeParse(project).success).toBe(false);

    document.presentation.cellSymbol.pinPlacements = [
      { terminalId: "terminal-input", side: "north", offset: 20 },
      { terminalId: "terminal-input", side: "north", offset: 20 },
    ];
    expect(CircuitProjectSchema.safeParse(project).success).toBe(false);

    document.presentation.cellSymbol.pinPlacements = undefined;
    document.presentation.cellSymbol.pinLabelPlacements = [
      { terminalId: "terminal-input", tangentOffset: 10, inwardOffset: 20 },
    ];
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);

    document.presentation.cellSymbol.pinLabelPlacements = [
      { terminalId: "missing-terminal", tangentOffset: 0, inwardOffset: 0 },
    ];
    expect(CircuitProjectSchema.safeParse(project).success).toBe(false);
  });
});
