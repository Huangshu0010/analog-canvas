import { serializeProject } from "@icm/project-protocol";
import { describe, expect, it } from "vitest";

import {
  createLibraryExampleProject,
  libraryProjectExamples,
} from "./library-examples";

describe("bundled Library Project examples", () => {
  it("ships two canonical, schema-valid Projects", () => {
    expect(libraryProjectExamples.map((example) => example.name)).toEqual([
      "Common-Source Amplifier",
      "Two-Stage Op Amp",
    ]);
    for (const example of libraryProjectExamples) {
      expect(serializeProject(example.project)).toContain(
        '"schemaVersion": 14',
      );
      expect(example.project.documents).toHaveLength(1);
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
