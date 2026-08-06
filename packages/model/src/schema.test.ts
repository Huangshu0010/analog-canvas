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
});
