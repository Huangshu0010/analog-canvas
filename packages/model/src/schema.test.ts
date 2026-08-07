import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import { CircuitProjectJsonSchema, CircuitProjectSchema } from "./schema.js";

describe("CircuitProject schema", () => {
  it("accepts a minimal Project with one Document", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(CircuitProjectSchema.parse(project)).toEqual(project);
    expect(CircuitProjectJsonSchema).toMatchObject({ type: "object" });
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

  it("allows route attachments only on current annotations", () => {
    const project = createEmptyProject("project-current", "Current");
    const document = project.documents[0]!;
    const attachment = {
      routeId: "route-1",
      segmentIndex: 0,
      t: 0.5,
      direction: "forward" as const,
      normalOffset: -14,
    };
    document.annotations.push({
      id: "current-1",
      kind: "current",
      text: "I_x",
      position: { x: 20, y: 20 },
      routeAttachment: attachment,
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    document.annotations[0] = { ...document.annotations[0]!, kind: "voltage" };
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
