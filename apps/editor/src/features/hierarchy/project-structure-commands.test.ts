import type { ProjectStructureEdit } from "@icm/edit-engine";
import { createEmptyDocument, createEmptyProject } from "@icm/model";
import {
  builtInSymbols,
  createProjectSymbolResolver,
  customSymbolId,
} from "@icm/symbols";
import { describe, expect, it, vi } from "vitest";

import { createProjectStructureCommands } from "./project-structure-commands";

function dependencies() {
  const project = createEmptyProject("project", "Project");
  const commitStructure = vi.fn<
    (
      transactionId: string,
      edits: ProjectStructureEdit[],
      activeDocumentId?: string,
    ) => boolean
  >(() => true);
  return {
    project,
    activeDocument: project.documents[0]!,
    resolver: createProjectSymbolResolver(project, builtInSymbols),
    commitStructure,
    setStatus: vi.fn(),
    onCellCreated: vi.fn(),
    nextSequence: vi.fn(() => 1),
    createDocumentId: vi.fn(() => "document-child"),
  };
}

describe("Project structure commands", () => {
  it("creates a trimmed Cell with inherited presentation and activates it", () => {
    const input = dependencies();
    input.activeDocument.presentation.grid = 25;
    const commands = createProjectStructureCommands(input);

    commands.createCell("  Child  ");

    const [transactionId, edits, activeDocumentId] =
      input.commitStructure.mock.calls[0]!;
    expect(transactionId).toBe("create-cell");
    expect(activeDocumentId).toBe("document-child");
    expect(edits).toMatchObject([
      {
        kind: "add_document",
        document: {
          id: "document-child",
          name: "Child",
          presentation: { grid: 25 },
          netlist: { name: "Child" },
        },
      },
    ]);
    expect(input.onCellCreated).toHaveBeenCalledOnce();
    expect(input.setStatus).toHaveBeenCalledWith("Created Cell Child");
  });

  it("deletes a Cell through the project structure boundary", () => {
    const input = dependencies();
    const child = createEmptyDocument("document-child", "Child");
    input.project.documents.push(child);
    const commands = createProjectStructureCommands(input);

    expect(commands.deleteCell(child.id)).toBe(true);

    expect(input.commitStructure).toHaveBeenCalledWith(
      "delete-cell",
      expect.arrayContaining([
        expect.objectContaining({
          kind: "remove_document",
          documentId: child.id,
        }),
      ]),
      input.project.topDocumentId,
    );
    expect(input.setStatus).toHaveBeenCalledWith("Deleted Cell Child");
  });

  it("normalizes formal parameters before committing their structural edit", () => {
    const input = dependencies();
    const child = createEmptyDocument("document-child", "Child");
    input.project.documents.push(child);
    const commands = createProjectStructureCommands(input);

    commands.setCellFormalParameters(
      [
        { name: "  gain  ", defaultValue: "  10  " },
        { name: "bias", defaultValue: "   " },
      ],
      child.id,
    );

    expect(input.commitStructure).toHaveBeenCalledWith(
      "set-cell-formal-parameters",
      expect.arrayContaining([
        {
          kind: "transact_document",
          documentId: child.id,
          expectedRevision: 0,
          edits: [
            {
              kind: "set_cell_formal_parameters",
              formalParameters: [
                { name: "gain", defaultValue: "10" },
                { name: "bias" },
              ],
            },
          ],
        },
      ]),
    );
  });

  it("rejects off-grid Cell symbol dimensions before planning", () => {
    const input = dependencies();
    const commands = createProjectStructureCommands(input);

    commands.setCellSymbolBodySize(input.activeDocument, 95, 100);

    expect(input.commitStructure).not.toHaveBeenCalled();
    expect(input.setStatus).toHaveBeenCalledWith(
      "Cell symbol size must use positive 10-unit grid values",
    );
  });

  it("owns Cell Pin annotation edits and structural deletion", () => {
    const input = dependencies();
    input.activeDocument.instances.push({
      id: "P1",
      symbolId: "port",
      placement: null,
    });
    input.activeDocument.nets.push({
      id: "net-in",
      terminals: [{ instanceId: "P1", pinName: "P" }],
    });
    input.activeDocument.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceIds: ["P1"],
    });
    const annotation = {
      id: "pin-label",
      kind: "instance-label" as const,
      binding: {
        kind: "cell-terminal-name" as const,
        terminalId: "terminal-in",
      },
      anchor: {
        kind: "object" as const,
        objectId: "P1",
        localOffset: { x: 0, y: 0 },
        fallbackPosition: { x: 0, y: 0 },
      },
      alignment: "middle" as const,
      rotation: 0 as const,
      locked: false,
    };
    input.activeDocument.annotations.push(annotation);
    const commands = createProjectStructureCommands(input);

    expect(commands.editCellTerminalAnnotation(annotation, "VIN")).toBe(true);
    expect(input.commitStructure).toHaveBeenCalledWith(
      "edit-cell-pin-label",
      expect.any(Array),
    );

    input.commitStructure.mockClear();
    expect(commands.deleteCellTerminal("terminal-in", "P1")).toBe(true);
    expect(input.commitStructure).toHaveBeenCalledWith(
      "delete-cell-pin",
      expect.arrayContaining([
        expect.objectContaining({ kind: "transact_document" }),
      ]),
    );
    expect(input.setStatus).toHaveBeenCalledWith("Deleted Cell Pin IN");
  });

  it("imports a custom symbol definition through the structure boundary", () => {
    const input = dependencies();
    const commands = createProjectStructureCommands(input);
    const definition = {
      id: "custom-symbol-def-1",
      symbol: {
        schemaVersion: 1 as const,
        id: "imported-block",
        name: "Imported Block",
        viewBox: { x: -20, y: -20, width: 40, height: 40 },
        pins: [
          {
            name: "A",
            role: "terminal" as const,
            at: { x: -20, y: 0 },
            direction: "west" as const,
            presentation: { visibility: "visible" as const },
          },
        ],
        primitives: [
          {
            kind: "line" as const,
            from: { x: -10, y: 0 },
            to: { x: 10, y: 0 },
          },
        ],
        variants: [],
      },
    };

    expect(commands.importCustomSymbolDefinition(definition)).toBe(true);

    expect(input.commitStructure).toHaveBeenCalledWith("import-custom-symbol", [
      { kind: "upsert_custom_symbol_definition", definition },
    ]);
    expect(input.setStatus).toHaveBeenCalledWith(
      "Imported symbol Imported Block",
    );
  });

  it("reports a full custom symbol library without committing", () => {
    const input = dependencies();
    for (let index = 0; index < 256; index += 1) {
      input.project.customSymbolDefinitions.push({
        id: `custom-symbol-def-${index}`,
        symbol: {
          schemaVersion: 1,
          id: `imported-${index}`,
          name: `Imported ${index}`,
          viewBox: { x: -10, y: -10, width: 20, height: 20 },
          pins: [],
          primitives: [],
          variants: [],
        },
      });
    }
    const commands = createProjectStructureCommands(input);

    expect(
      commands.importCustomSymbolDefinition({
        id: "custom-symbol-def-next",
        symbol: {
          schemaVersion: 1,
          id: "imported-next",
          name: "Imported Next",
          viewBox: { x: -10, y: -10, width: 20, height: 20 },
          pins: [],
          primitives: [],
          variants: [],
        },
      }),
    ).toBe(false);

    expect(input.commitStructure).not.toHaveBeenCalled();
    expect(input.setStatus).toHaveBeenCalledWith(
      "Custom symbol library is full (256 definitions)",
    );
  });

  it("renames a custom symbol through an artwork replacement", () => {
    const input = dependencies();
    const definition = {
      id: "custom-symbol-def-1",
      symbol: {
        schemaVersion: 1 as const,
        id: "imported-block",
        name: "Imported Block",
        viewBox: { x: -20, y: -20, width: 40, height: 40 },
        pins: [],
        primitives: [
          {
            kind: "line" as const,
            from: { x: -10, y: 0 },
            to: { x: 10, y: 0 },
          },
        ],
        variants: [],
      },
    };
    input.project.customSymbolDefinitions.push(definition);
    const commands = createProjectStructureCommands(input);

    expect(commands.renameCustomSymbol(definition.id, "  My Block  ")).toBe(
      true,
    );

    expect(input.commitStructure).toHaveBeenCalledWith("rename-custom-symbol", [
      {
        kind: "upsert_custom_symbol_definition",
        definition: {
          id: definition.id,
          symbol: { ...definition.symbol, name: "My Block" },
        },
      },
    ]);
    expect(input.setStatus).toHaveBeenCalledWith("Renamed symbol to My Block");
  });

  it("refuses to rename a custom symbol to an empty name", () => {
    const input = dependencies();
    const definition = {
      id: "custom-symbol-def-1",
      symbol: {
        schemaVersion: 1 as const,
        id: "imported-block",
        name: "Imported Block",
        viewBox: { x: -20, y: -20, width: 40, height: 40 },
        pins: [],
        primitives: [],
        variants: [],
      },
    };
    input.project.customSymbolDefinitions.push(definition);
    const commands = createProjectStructureCommands(input);

    expect(commands.renameCustomSymbol(definition.id, "   ")).toBe(false);
    expect(input.commitStructure).not.toHaveBeenCalled();
    expect(input.setStatus).toHaveBeenCalledWith(
      "A custom symbol name cannot be empty",
    );
  });

  it("removes an unreferenced custom symbol through the structure boundary", () => {
    const input = dependencies();
    const definition = {
      id: "custom-symbol-def-1",
      symbol: {
        schemaVersion: 1 as const,
        id: "imported-block",
        name: "Imported Block",
        viewBox: { x: -20, y: -20, width: 40, height: 40 },
        pins: [],
        primitives: [],
        variants: [],
      },
    };
    input.project.customSymbolDefinitions.push(definition);
    const commands = createProjectStructureCommands(input);

    expect(commands.removeCustomSymbolDefinition(definition.id)).toBe(true);

    expect(input.commitStructure).toHaveBeenCalledWith("remove-custom-symbol", [
      { kind: "remove_custom_symbol_definition", definitionId: definition.id },
    ]);
    expect(input.setStatus).toHaveBeenCalledWith("Removed the imported symbol");
  });

  it("refuses to remove a custom symbol that is still placed", () => {
    const input = dependencies();
    const definition = {
      id: "custom-symbol-def-1",
      symbol: {
        schemaVersion: 1 as const,
        id: "imported-block",
        name: "Imported Block",
        viewBox: { x: -20, y: -20, width: 40, height: 40 },
        pins: [],
        primitives: [],
        variants: [],
      },
    };
    input.project.customSymbolDefinitions.push(definition);
    input.activeDocument.instances.push({
      id: "X1",
      symbolId: customSymbolId(definition.id),
      placement: null,
    });
    const commands = createProjectStructureCommands(input);

    expect(commands.removeCustomSymbolDefinition(definition.id)).toBe(false);

    expect(input.commitStructure).not.toHaveBeenCalled();
    expect(input.setStatus).toHaveBeenCalledWith(
      "Custom symbol Imported Block is still placed 1 time in this project",
    );
  });
});
