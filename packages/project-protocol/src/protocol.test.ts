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

  it("keeps the direct schema-11 to schema-12 upgrade", () => {
    const current = JSON.parse(
      serializeProject(createEmptyProject("protocol-project", "Protocol")),
    ) as Record<string, unknown>;
    const result = tryParseProjectWithMetadata(
      JSON.stringify({
        ...current,
        schemaVersion: 11,
        structureRevision: undefined,
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      sourceSchemaVersion: 11,
      migrated: true,
      project: { schemaVersion: 12, structureRevision: 0 },
    });
  });

  it("serializes only the current schema", () => {
    const project = createEmptyProject("protocol-project", "Protocol");
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
});
