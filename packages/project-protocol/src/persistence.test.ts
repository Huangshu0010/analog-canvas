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

  it("directly upgrades schema 10 and reports its source version", () => {
    const project = createEmptyProject("project-test", "Test Project");
    const source = {
      ...JSON.parse(serializeProject(project)),
      schemaVersion: 10,
    };
    source.documents[0].annotations.push({
      id: "plain-v10-value",
      kind: "instance-value",
      content: { runs: [{ kind: "text", value: "20u/1u" }] },
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      alignment: "start",
      rotation: 0,
      locked: false,
    });
    const parsed = parseProjectWithMetadata(JSON.stringify(source));

    expect(parsed).toMatchObject({
      sourceSchemaVersion: 10,
      migrated: true,
      project: { schemaVersion: 11 },
    });
    expect({ ...parsed.project, schemaVersion: 10 }).toEqual(source);
  });

  it("lets an upgraded schema-10 Project author and persist a schema-11 fraction", () => {
    const source = {
      ...JSON.parse(
        serializeProject(createEmptyProject("project-test", "Test Project")),
      ),
      schemaVersion: 10,
    };
    const project = parseProject(JSON.stringify(source));
    project.documents[0]!.annotations.push({
      id: "value-fraction",
      kind: "instance-value",
      content: {
        runs: [
          {
            kind: "fraction",
            numerator: { runs: [{ kind: "text", value: "10um" }] },
            denominator: { runs: [{ kind: "text", value: "150nm" }] },
          },
        ],
      },
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      alignment: "start",
      rotation: 0,
      locked: false,
    });

    const reopened = parseProject(serializeProject(project));
    expect(reopened.schemaVersion).toBe(11);
    expect(
      reopened.documents[0]!.annotations[0]?.content.runs[0],
    ).toMatchObject({
      kind: "fraction",
      numerator: { runs: [{ value: "10um" }] },
      denominator: { runs: [{ value: "150nm" }] },
    });
  });

  it("rejects schemas outside the rolling current-and-previous window", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 99 })),
    ).toThrow(/must be 10 or 11/);
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 9 })),
    ).toThrow(/must be 10 or 11/);
  });
});
