import { describe, expect, it } from "vitest";

import { createEmptyProject } from "@icm/model";

import {
  parseProject,
  serializeProject,
  tryParseProjectWithMetadata,
} from "./index.js";

describe("Project protocol boundary", () => {
  it("returns diagnostics instead of throwing for invalid JSON", () => {
    expect(tryParseProjectWithMetadata("{")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "INVALID_JSON" }],
    });
  });

  it("keeps the direct schema-18 to schema-19 upgrade", () => {
    const current = JSON.parse(
      serializeProject(createEmptyProject("protocol-project", "Protocol")),
    ) as Record<string, unknown>;
    const result = tryParseProjectWithMetadata(
      JSON.stringify({
        ...current,
        schemaVersion: 18,
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      sourceSchemaVersion: 18,
      migrated: true,
      project: { schemaVersion: 19, structureRevision: 0 },
    });
  });

  it("serializes only the current schema", () => {
    const project = createEmptyProject("protocol-project", "Protocol");
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
});
