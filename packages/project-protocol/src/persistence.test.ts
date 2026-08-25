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

  it("upgrades the singular schema-23 Cell Pin marker contract", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-test", "Test Project")),
    ) as Record<string, any>;
    source.schemaVersion = 23;
    const document = source.documents[0];
    document.instances.push({ id: "P1", symbolId: "port", placement: null });
    document.nets.push({
      id: "net-in",
      terminals: [{ instanceId: "P1", pinName: "P" }],
    });
    document.netlist.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceIds: ["P1"],
    });

    const migrated = parseProjectWithMetadata(JSON.stringify(source));
    expect(migrated).toMatchObject({
      sourceSchemaVersion: 23,
      migrated: true,
      project: { schemaVersion: 24 },
    });
    expect(migrated.project.documents[0]!.netlist?.terminals[0]).toMatchObject({
      name: "IN",
      interfaceInstanceId: "P1",
    });
  });

  it("rejects schemas outside the current-and-previous window", () => {
    const project = createEmptyProject("project-test", "Test Project");
    for (const schemaVersion of [22, 25, 99]) {
      expect(() =>
        parseProject(JSON.stringify({ ...project, schemaVersion })),
      ).toThrow(/must be 23 or 24/);
    }
  });
});
