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

  it("upgrades schema-17 default labels and formal Ports to their schema-18 identities", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-test", "Test Project")),
    );
    source.schemaVersion = 17;
    source.documents[0].instances.push({
      id: "P-object",
      symbolId: "port",
      schematicReference: "P1",
      placement: null,
    });
    source.documents[0].instances.push({
      id: "opaque-resistor-id",
      symbolId: "resistor",
      schematicReference: "R7",
      placement: null,
      netlist: { reference: "R7", parameters: {} },
    });
    source.documents[0].netlist = {
      name: "Child",
      terminals: [
        {
          id: "terminal-vout",
          name: "Vout",
          netId: "net-vout",
          direction: "output",
          interfaceInstanceId: "P-object",
        },
      ],
      formalParameters: [],
    };
    source.documents[0].nets.push({
      id: "net-vout",
      scope: "local",
      terminals: [{ instanceId: "P-object", pinName: "P" }],
    });
    source.documents[0].annotations.push(
      {
        id: "reference-P",
        kind: "instance-label",
        binding: { kind: "instance-designator", instanceId: "P-object" },
        anchor: { kind: "free", position: { x: 0, y: 0 } },
        alignment: "start",
        rotation: 0,
        locked: false,
      },
      {
        id: "reference-R7",
        kind: "instance-label",
        binding: {
          kind: "instance-designator",
          instanceId: "opaque-resistor-id",
        },
        anchor: { kind: "free", position: { x: 40, y: 0 } },
        alignment: "start",
        rotation: 0,
        locked: false,
      },
      {
        id: "terminal-name",
        kind: "instance-label",
        binding: {
          kind: "cell-terminal-name",
          terminalId: "terminal-vout",
        },
        anchor: { kind: "free", position: { x: 20, y: 0 } },
        alignment: "start",
        rotation: 0,
        locked: false,
      },
    );

    const migrated = parseProjectWithMetadata(JSON.stringify(source));
    expect(migrated).toMatchObject({
      sourceSchemaVersion: 17,
      migrated: true,
      project: { schemaVersion: 18 },
    });
    expect(
      migrated.project.documents[0]!.annotations.map(
        (annotation) => annotation.binding,
      ),
    ).toEqual([
      { kind: "cell-terminal-name", terminalId: "terminal-vout" },
      { kind: "instance-schematic-name", instanceId: "opaque-resistor-id" },
    ]);
    expect(migrated.project.documents[0]!.instances[0]).toMatchObject({
      id: "P-object",
    });
    expect(migrated.project.documents[0]!.instances[0]).not.toHaveProperty(
      "schematicReference",
    );
  });

  it("lets an upgraded previous Project author and persist current content", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-test", "Test Project")),
    );
    source.schemaVersion = 17;
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
    expect(reopened.schemaVersion).toBe(18);
    expect(
      reopened.documents[0]!.annotations[0]?.content!.runs[0],
    ).toMatchObject({ kind: "fraction" });
  });

  it("rejects schemas outside the rolling current-and-previous window", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 99 })),
    ).toThrow(/must be 17 or 18/);
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 16 })),
    ).toThrow(/must be 17 or 18/);
  });
});
