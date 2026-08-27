import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyProject } from "@icm/model";
import {
  ProjectFormatError,
  loadProject,
  parseProject,
  parseProjectWithMetadata,
  saveProject,
  serializeProject,
  type ProjectStorage,
} from "./index.js";

class MemoryStorage implements ProjectStorage {
  readonly files = new Map<string, string>();

  async readText(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`Missing file: ${path}`);
    return content;
  }

  async writeTextAtomically(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

describe("Project persistence", () => {
  it("accepts the canonical fixture and rejects the invalid fixture", () => {
    const validPath = resolve(
      process.cwd(),
      "fixtures/projects/minimal/project.icproj.json",
    );
    const rejectedPath = resolve(
      process.cwd(),
      "fixtures/projects/rejected-missing-top/project.icproj.json",
    );
    const validText = readFileSync(validPath, "utf8");
    expect(serializeProject(parseProject(validText))).toBe(validText);
    expect(() => parseProject(readFileSync(rejectedPath, "utf8"))).toThrow(
      /Unknown top document/,
    );
  });

  it("is canonical across save, load, and save", async () => {
    const storage = new MemoryStorage();
    const project = createEmptyProject("project-test", "Test Project");
    await saveProject(storage, "project.icproj.json", project);
    const first = storage.files.get("project.icproj.json");
    const loaded = await loadProject(storage, "project.icproj.json");
    await saveProject(storage, "project.icproj.json", loaded);
    expect(storage.files.get("project.icproj.json")).toBe(first);
    expect(first?.endsWith("\n")).toBe(true);
  });

  it("rejects invalid JSON with a typed diagnostic", () => {
    try {
      parseProject("{");
      throw new Error("Expected parseProject to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectFormatError);
      expect((error as ProjectFormatError).diagnostics[0]?.code).toBe(
        "INVALID_JSON",
      );
    }
  });

  it("upgrades schema-25 projects by defaulting custom symbols to empty", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-test", "Test Project")),
    ) as Record<string, any>;
    delete source.customSymbolDefinitions;
    source.schemaVersion = 25;

    const migrated = parseProjectWithMetadata(JSON.stringify(source));
    expect(migrated).toMatchObject({
      sourceSchemaVersion: 25,
      migrated: true,
      project: {
        schemaVersion: 26,
        customSymbolDefinitions: [],
      },
    });
  });

  it("preserves persisted custom symbol definitions through the upgrade", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-test", "Test Project")),
    ) as Record<string, any>;
    source.customSymbolDefinitions = [
      {
        id: "custom-def-1",
        symbol: {
          schemaVersion: 1,
          id: "imported-artwork",
          name: "Imported Block",
          viewBox: { x: -20, y: -20, width: 40, height: 40 },
          pins: [
            {
              name: "A",
              role: "terminal",
              at: { x: -20, y: 0 },
              direction: "west",
              presentation: { visibility: "visible" },
            },
            {
              name: "Y",
              role: "terminal",
              at: { x: 20, y: 0 },
              direction: "east",
              presentation: { visibility: "visible" },
            },
          ],
          primitives: [
            {
              kind: "line",
              from: { x: -10, y: 0 },
              to: { x: 10, y: 0 },
            },
          ],
          variants: [],
        },
      },
    ];
    source.schemaVersion = 25;

    const migrated = parseProjectWithMetadata(JSON.stringify(source));
    expect(migrated.project.customSymbolDefinitions).toHaveLength(1);
    expect(migrated.project.customSymbolDefinitions[0]).toMatchObject({
      id: "custom-def-1",
      symbol: { id: "imported-artwork", name: "Imported Block" },
    });
  });

  it("rejects schemas outside the current-and-previous window", () => {
    const project = createEmptyProject("project-test", "Test Project");
    for (const schemaVersion of [24, 27, 99]) {
      expect(() =>
        parseProject(JSON.stringify({ ...project, schemaVersion })),
      ).toThrow(/must be 25 or 26/);
    }
  });
});
