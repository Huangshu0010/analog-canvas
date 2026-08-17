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

  it("keeps the direct schema-10 to schema-11 upgrade", () => {
    const current = JSON.parse(
      serializeProject(createEmptyProject("protocol-project", "Protocol")),
    ) as Record<string, unknown>;
    const result = tryParseProjectWithMetadata(
      JSON.stringify({ ...current, schemaVersion: 10 }),
    );
    expect(result).toMatchObject({
      ok: true,
      sourceSchemaVersion: 10,
      migrated: true,
      project: { schemaVersion: 11 },
    });
  });

  it("serializes only the current schema", () => {
    const project = createEmptyProject("protocol-project", "Protocol");
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
});
