import {
  planCreateCell,
  planRenameCell,
  planRenameCellTerminal,
  planReorderCellTerminal,
  planSetCellSymbolPresentation,
  planSetCellTerminalPlacement,
  planUpdateCellTerminalDirection,
  proposeSetCellFormalParameters,
  proposeUpsertExternalSubcircuitDefinition,
} from "@icm/edit-engine";
import type { ProjectStructureEdit } from "@icm/edit-engine";
import { createEmptyDocument, createId } from "@icm/model";
import type {
  CircuitProject,
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";

type CellDirection = "input" | "output" | "inout" | "passive";
type CellPinSide = "north" | "east" | "south" | "west" | "auto";
type FormalParameters = NonNullable<
  SchematicDocument["netlist"]
>["formalParameters"];

export interface ProjectStructureCommandDependencies {
  project: CircuitProject;
  activeDocument: SchematicDocument;
  commitStructure: (
    transactionId: string,
    edits: ProjectStructureEdit[],
    activeDocumentId?: string,
  ) => boolean;
  setStatus: (status: string) => void;
  onCellCreated: () => void;
  createDocumentId?: () => string;
}

/**
 * Owns behavior-neutral UI commands for formal Project structure. Planners and
 * the Edit Engine remain the semantic authority; this facade normalizes user
 * input, selects transaction names, and projects successful outcomes to UI
 * status without taking ownership of navigation or pointer interaction.
 */
export function createProjectStructureCommands({
  project,
  activeDocument,
  commitStructure,
  setStatus,
  onCellCreated,
  createDocumentId = () => createId("document"),
}: ProjectStructureCommandDependencies) {
  const createCell = (inputName: string): void => {
    const name = inputName.trim();
    if (!name) return;
    const child = createEmptyDocument(createDocumentId(), name);
    child.netlist!.name = name;
    child.presentation = structuredClone(activeDocument.presentation);
    if (commitStructure("create-cell", planCreateCell(child), child.id)) {
      onCellCreated();
      setStatus(`Created Cell ${name}`);
    }
  };

  const renameCell = (documentId: string, inputName: string): void => {
    const target = project.documents.find(
      (candidate) => candidate.id === documentId,
    );
    const name = inputName.trim();
    if (!target || !name || name === target.name) return;
    if (
      commitStructure("rename-cell", planRenameCell(project, documentId, name))
    ) {
      setStatus(`Renamed Cell to ${name}`);
    }
  };

  const updateCellPinDirection = (
    terminalId: string,
    direction: CellDirection,
    targetDocumentId = activeDocument.id,
  ): void => {
    const targetDocument = project.documents.find(
      (candidate) => candidate.id === targetDocumentId,
    );
    if (!targetDocument?.netlist) return;
    if (
      commitStructure(
        "update-cell-pin-direction",
        planUpdateCellTerminalDirection(
          project,
          targetDocumentId,
          terminalId,
          direction,
        ),
      )
    ) {
      setStatus("Updated Cell port direction");
    }
  };

  const renameCellTerminal = (
    terminalId: string,
    inputName: string,
    targetDocumentId = activeDocument.id,
    transactionId = "rename-cell-interface-terminal",
  ): void => {
    const nextName = inputName.trim();
    const targetDocument = project.documents.find(
      (candidate) => candidate.id === targetDocumentId,
    );
    const terminal = targetDocument?.netlist?.terminals.find(
      (candidate) => candidate.id === terminalId,
    );
    if (!terminal || !nextName || terminal.name === nextName) return;
    try {
      if (
        commitStructure(
          transactionId,
          planRenameCellTerminal(
            project,
            targetDocumentId,
            terminalId,
            nextName,
          ),
        )
      ) {
        setStatus(`Renamed Cell Pin to ${nextName}`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not rename port",
      );
    }
  };

  const moveCellTerminal = (
    terminalId: string,
    delta: -1 | 1,
    targetDocumentId = activeDocument.id,
  ): void => {
    const edits = planReorderCellTerminal(
      project,
      targetDocumentId,
      terminalId,
      delta,
    );
    if (edits.length === 0) return;
    if (commitStructure("reorder-cell-interface-terminal", edits)) {
      setStatus("Reordered formal terminal interface");
    }
  };

  const setCellFormalParameters = (
    formalParameters: FormalParameters,
    targetDocumentId = activeDocument.id,
  ): void => {
    try {
      const proposal = proposeSetCellFormalParameters(
        project,
        targetDocumentId,
        formalParameters.map((parameter) => ({
          name: parameter.name.trim(),
          ...(parameter.defaultValue?.trim()
            ? { defaultValue: parameter.defaultValue.trim() }
            : {}),
        })),
      );
      if (commitStructure("set-cell-formal-parameters", [...proposal.edits])) {
        setStatus("Updated Cell formal parameters");
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not update Cell formal parameters",
      );
    }
  };

  const setExternalSubcircuitDefinition = (
    definition: ExternalSubcircuitDefinition,
  ): void => {
    try {
      const proposal = proposeUpsertExternalSubcircuitDefinition(
        project,
        definition,
      );
      if (proposal.diagnostics.length > 0) {
        setStatus(
          `Cannot update external interface: ${proposal.diagnostics[0]}`,
        );
        return;
      }
      if (
        commitStructure("upsert-external-subcircuit-interface", [
          ...proposal.edits,
        ])
      ) {
        setStatus(`Updated external subcircuit ${definition.name}`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not update external subcircuit interface",
      );
    }
  };

  const setCellSymbolBodySize = (
    child: SchematicDocument,
    width: number,
    height: number,
  ): void => {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width % 10 !== 0 ||
      height % 10 !== 0
    ) {
      setStatus("Cell symbol size must use positive 10-unit grid values");
      return;
    }
    const current = child.presentation.cellSymbol;
    if (
      commitStructure(
        "resize-cell-symbol",
        planSetCellSymbolPresentation(project, child.id, {
          ...(current?.pinPlacements
            ? { pinPlacements: current.pinPlacements }
            : {}),
          minimumBodySize: { width, height },
        }),
      )
    ) {
      setStatus(`Resized ${child.name} symbol for every parent instance`);
    }
  };

  const setCellSymbolPortPlacement = (
    child: SchematicDocument,
    terminalId: string,
    side: CellPinSide,
    offset: number,
  ): void => {
    try {
      if (
        commitStructure(
          "move-cell-symbol-pin",
          planSetCellTerminalPlacement(
            project,
            child.id,
            terminalId,
            side,
            offset,
          ),
        )
      ) {
        setStatus("Moved Cell symbol pin in every parent instance");
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not move Cell symbol pin",
      );
    }
  };

  const renameProject = (inputName: string | null): void => {
    const name = (inputName ?? "").trim();
    if (!name || name === project.name) return;
    if (commitStructure("rename-project", [{ kind: "rename_project", name }])) {
      setStatus(`Renamed circuit to ${name}`);
    }
  };

  return {
    createCell,
    renameCell,
    updateCellPinDirection,
    renameCellTerminal,
    moveCellTerminal,
    setCellFormalParameters,
    setExternalSubcircuitDefinition,
    setCellSymbolBodySize,
    setCellSymbolPortPlacement,
    renameProject,
  };
}
