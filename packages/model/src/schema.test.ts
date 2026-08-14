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
});
