import type { ProjectStructureEdit } from "@icm/edit-engine";
import { createEmptyDocument, createEmptyProject } from "@icm/model";
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
    commitStructure,
    setStatus: vi.fn(),
    onCellCreated: vi.fn(),
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
});
