import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";
import { serializeProject } from "@icm/project-protocol";
import { describe, expect, it } from "vitest";

import {
  createLibraryExampleProject,
  libraryProjectExamples,
} from "./library-examples";

describe("bundled Library Project examples", () => {
  it("ships canonical, schema-current, openable Projects", () => {
    // The curated pair stays; promoted examples may extend the set (see
    // scripts/promote-example.mjs), so the contract is per-example, not a
    // frozen count or single-document shape.
    expect(libraryProjectExamples.map((example) => example.id)).toEqual(
      expect.arrayContaining(["common-source-amplifier", "two-stage-op-amp"]),
    );
    expect(
      new Set(libraryProjectExamples.map((example) => example.id)).size,
    ).toBe(libraryProjectExamples.length);
    for (const example of libraryProjectExamples) {
      expect(example.name.trim()).not.toBe("");
      expect(serializeProject(example.project)).toContain(
        `"schemaVersion": ${CURRENT_PROJECT_SCHEMA_VERSION}`,
      );
      expect(example.project.documents.length).toBeGreaterThanOrEqual(1);
      expect(
        example.project.documents.some(
          (document) => document.id === example.project.topDocumentId,
        ),
      ).toBe(true);
    }
  });

  it("returns a fresh Project snapshot for every selected example", () => {
    const first = createLibraryExampleProject("common-source-amplifier");
    const second = createLibraryExampleProject("common-source-amplifier");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;
    first.name = "Changed only in this snapshot";
    expect(second.name).toBe("New Circuit");
    expect(createLibraryExampleProject("missing-example")).toBeNull();
  });
});
