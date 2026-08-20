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

  it("directly upgrades schema 13 properties to netlist parameters", () => {
    const project = createEmptyProject("project-test", "Test Project");
    const source = {
      ...JSON.parse(serializeProject(project)),
      schemaVersion: 13,
    };
    delete source.externalSubcircuitDefinitions;
    delete source.documents[0].netlist.formalParameters;
    source.documents[0].instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      properties: { value: "20k" },
    });
    source.documents[0].annotations.push({
      id: "plain-v13-value",
      kind: "instance-value",
      content: { runs: [{ kind: "text", value: "20u/1u" }] },
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      alignment: "start",
      rotation: 0,
      locked: false,
    });
    const parsed = parseProjectWithMetadata(JSON.stringify(source));

    expect(parsed).toMatchObject({
      sourceSchemaVersion: 13,
      migrated: true,
      project: {
        schemaVersion: 14,
        structureRevision: 0,
        externalSubcircuitDefinitions: [],
        documents: [
          {
            netlist: { formalParameters: [] },
            instances: [
              {
                id: "R1",
                netlist: { reference: "R1", parameters: { value: "20k" } },
              },
            ],
          },
        ],
      },
    });
    expect(parsed.project.documents[0]!.instances[0]).not.toHaveProperty(
      "properties",
    );
  });

  it("lets an upgraded schema-13 Project author and persist schema-14 content", () => {
    const source = {
      ...JSON.parse(
        serializeProject(createEmptyProject("project-test", "Test Project")),
      ),
      schemaVersion: 13,
    };
    delete source.externalSubcircuitDefinitions;
    delete source.documents[0].netlist.formalParameters;
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
    expect(reopened.schemaVersion).toBe(14);
    expect(
      reopened.documents[0]!.annotations[0]?.content!.runs[0],
    ).toMatchObject({
      kind: "fraction",
      numerator: { runs: [{ value: "10um" }] },
      denominator: { runs: [{ value: "150nm" }] },
    });
  });

  it("rejects conflicting legacy electrical values instead of choosing one", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-conflict", "Conflict")),
    );
    source.schemaVersion = 13;
    delete source.externalSubcircuitDefinitions;
    delete source.documents[0].netlist.formalParameters;
    source.documents[0].instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      properties: { value: "10k" },
      netlist: { reference: "R1", parameters: { value: "20k" } },
    });

    expect(() => parseProject(JSON.stringify(source))).toThrow(
      /conflicts with netlist.parameters.value/,
    );
  });

  it("groups consistent external imports and preserves a conflicting one as unresolved", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-external", "External")),
    );
    source.schemaVersion = 13;
    delete source.externalSubcircuitDefinitions;
    delete source.documents[0].netlist.formalParameters;
    const imported = (id: string, pinName: string) => ({
      id,
      symbolId: "generic-block-2",
      placement: null,
      netlist: {
        reference: id,
        parameters: {},
        terminals: [{ sourcePosition: 0, pinName }],
        binding: { kind: "external-subcircuit", name: "OPA" },
      },
    });
    source.documents[0].instances.push(
      imported("X1", "IN"),
      imported("X2", "INPUT"),
    );

    const migrated = parseProject(JSON.stringify(source));
    expect(migrated.externalSubcircuitDefinitions).toEqual([
      {
        id: "external-subcircuit-opa",
        name: "OPA",
        terminals: [{ name: "IN" }],
        formalParameters: [],
      },
    ]);
    expect(
      migrated.documents[0]!.instances.map(
        (instance) => instance.netlist!.binding,
      ),
    ).toEqual([
      { kind: "external-subcircuit", definitionId: "external-subcircuit-opa" },
      { kind: "unresolved-subcircuit", name: "OPA" },
    ]);
  });

  it("rejects schemas outside the rolling current-and-previous window", () => {
    const project = createEmptyProject("project-test", "Test Project");
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 99 })),
    ).toThrow(/must be 13 or 14/);
    expect(() =>
      parseProject(JSON.stringify({ ...project, schemaVersion: 12 })),
    ).toThrow(/must be 13 or 14/);
  });

  it("preserves schema-13 formal terminal identity without adding visual intent", () => {
    const source = JSON.parse(
      serializeProject(createEmptyProject("project-port", "Port migration")),
    );
    source.schemaVersion = 13;
    delete source.externalSubcircuitDefinitions;
    delete source.documents[0].netlist.formalParameters;
    source.documents[0].nets.push({
      id: "net-input",
      name: "VIN",
      scope: "local",
      terminals: [],
    });
    source.documents[0].instances.push({
      id: "P1",
      symbolId: "port",
      placement: null,
    });
    source.documents[0].netlist.terminals.push({
      id: "terminal-input",
      name: "VIN",
      netId: "net-input",
      direction: "input",
      interfaceInstanceId: "P1",
    });
    source.documents[0].nets[0].terminals.push({
      instanceId: "P1",
      pinName: "P",
    });

    const migrated = parseProjectWithMetadata(JSON.stringify(source));
    const document = migrated.project.documents[0]!;
    const terminal = document.netlist!.terminals[0]!;
    const marker = document.instances.find(
      (instance) => instance.id === terminal.interfaceInstanceId,
    );

    expect(migrated).toMatchObject({
      sourceSchemaVersion: 13,
      migrated: true,
    });
    expect(terminal).toMatchObject({
      name: "VIN",
      netId: "net-input",
      direction: "input",
    });
    expect(terminal.id).toBe("terminal-input");
    expect(marker).toMatchObject({
      id: "P1",
      symbolId: "port",
      placement: null,
    });
    expect(document.presentation.cellSymbol).toBeUndefined();
  });
});
