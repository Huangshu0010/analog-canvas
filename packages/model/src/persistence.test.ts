import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import {
  ProjectFormatError,
  ProjectMigrationRegistry,
  loadProject,
  parseProject,
  saveProject,
  serializeProject,
  type ProjectStorage,
} from "./persistence.js";

class MemoryStorage implements ProjectStorage {
  readonly files = new Map<string, string>();

  async readText(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`Missing file: ${path}`);
    }
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

  it("rejects an unknown future schema version", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 99 })),
    ).toThrow(/newer than supported/);
  });

  it("registers explicit advancing migrations", () => {
    const registry = new ProjectMigrationRegistry();
    registry.register(0, (input) => ({ ...input, schemaVersion: 1 }));
    registry.register(1, (input) => ({ ...input, schemaVersion: 2 }));
    registry.register(2, (input) => ({ ...input, schemaVersion: 3 }));
    registry.register(3, (input) => ({ ...input, schemaVersion: 4 }));
    registry.register(4, (input) => ({ ...input, schemaVersion: 5 }));
    registry.register(5, (input) => ({ ...input, schemaVersion: 6 }));
    registry.register(6, (input) => ({ ...input, schemaVersion: 7 }));
    registry.register(7, (input) => ({ ...input, schemaVersion: 8 }));
    const current = createEmptyProject("project-test", "Test Project");
    const legacy = { ...current, schemaVersion: 0 };
    expect(parseProject(serializeProject(current), registry)).toEqual(current);
    expect(parseProject(JSON.stringify(legacy), registry)).toEqual(current);
  });
});
