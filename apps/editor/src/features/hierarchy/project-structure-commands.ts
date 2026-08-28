import {
  planEditCellTerminalAnnotation,
  planCreateCell,
  planDeleteCell,
  planInstanceDeletion,
  planRemoveCellTerminals,
  planRenameCell,
  planRenameCellTerminal,
  planReorderCellTerminal,
  planSetCellSymbolPresentation,
  planSetCellTerminalPlacement,
  planUpdateCellTerminalDirection,
  proposeSetCellFormalParameters,
  proposeUpsertExternalSubcircuitDefinition,
  planRemoveCustomSymbolDefinition,
  planRenameCustomSymbol,
  planUpsertCustomSymbolDefinition,
} from "@icm/edit-engine";
import type { ProjectStructureEdit, SchematicEdit } from "@icm/edit-engine";
import {
  createEmptyDocument,
  createId,
  semanticTextDocument,
} from "@icm/model";
import type {
  Annotation,
  CircuitProject,
  CustomSymbolDefinition,
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

type CellDirection = "input" | "output" | "inout" | "passive";
type CellPinSide = "north" | "east" | "south" | "west" | "auto";
type FormalParameters = NonNullable<
  SchematicDocument["netlist"]
>["formalParameters"];

export interface ProjectStructureCommandDependencies {
  project: CircuitProject;
  activeDocument: SchematicDocument;
  resolver: SymbolResolver;
  commitStructure: (
    transactionId: string,
    edits: ProjectStructureEdit[],
    activeDocumentId?: string,
  ) => boolean;
  setStatus: (status: string) => void;
  onCellCreated: () => void;
  nextSequence: () => number;
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
  resolver,
  commitStructure,
  setStatus,
  onCellCreated,
  nextSequence,
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

  const deleteCell = (documentId: string): boolean => {
    const target = project.documents.find(
      (candidate) => candidate.id === documentId,
    );
    if (!target) return false;
    const committed = commitStructure(
      "delete-cell",
      planDeleteCell(project, documentId),
      project.topDocumentId,
    );
    if (committed) setStatus(`Deleted Cell ${target.name}`);
    return committed;
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

  const editCellTerminalAnnotation = (
    annotation: Annotation,
    inputName: string,
  ): boolean => {
    if (annotation.anchor.kind !== "object") return false;
    const interfaceInstanceId = annotation.anchor.objectId;
    const terminal = activeDocument.netlist?.terminals.find((candidate) =>
      candidate.interfaceInstanceIds.includes(interfaceInstanceId),
    );
    if (!terminal) return false;
    try {
      const {
        content,
        formatOverride,
        binding: _binding,
        ...annotationPresentation
      } = annotation;
      const editedContent = formatOverride ?? content;
      const semanticContent = semanticTextDocument(inputName, "formal-port");
      const normalizedAnnotation: Annotation = {
        ...annotationPresentation,
        binding: {
          kind: "cell-terminal-name",
          terminalId: terminal.id,
        },
        ...(editedContent &&
        JSON.stringify(editedContent) !== JSON.stringify(semanticContent)
          ? { formatOverride: editedContent }
          : {}),
      };
      const renamed = terminal.name !== inputName;
      const edits = planEditCellTerminalAnnotation(
        project,
        activeDocument.id,
        terminal.id,
        normalizedAnnotation,
        inputName,
      );
      if (edits.length === 0) {
        setStatus(`Cell Pin ${terminal.name} is already current`);
        return true;
      }
      const committed = commitStructure("edit-cell-pin-label", edits);
      if (committed) {
        setStatus(
          renamed
            ? `Renamed Cell Pin to ${inputName}`
            : `Formatted Cell Pin ${inputName}`,
        );
      }
      return committed;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not rename port",
      );
      return false;
    }
  };

  const removeCellTerminalSelection = (
    terminalIds: readonly string[],
    documentEdits: readonly SchematicEdit[],
  ): boolean =>
    commitStructure(
      "delete-cell-pin-selection",
      planRemoveCellTerminals(project, activeDocument.id, terminalIds, [
        ...documentEdits,
      ]),
    );

  const deleteCellTerminal = (
    terminalId: string,
    interfaceInstanceId: string,
  ): boolean => {
    const terminal = activeDocument.netlist?.terminals.find(
      (candidate) => candidate.id === terminalId,
    );
    if (!terminal) return false;
    try {
      const edits = planRemoveCellTerminals(
        project,
        activeDocument.id,
        [terminalId],
        planInstanceDeletion(
          activeDocument,
          resolver,
          [interfaceInstanceId],
          nextSequence(),
        ),
      );
      const committed = commitStructure("delete-cell-pin", edits);
      if (committed) setStatus(`Deleted Cell Pin ${terminal.name}`);
      return committed;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not delete port",
      );
      return false;
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

  /**
   * Import (or replace, by definition ID) one user-defined symbol definition
   * from an already validated Symbol DSL payload. The definition ID is minted
   * by the import flow, so a fresh import never collides and a re-import of
   * the same file replaces its artwork in place.
   */
  const importCustomSymbolDefinition = (
    definition: CustomSymbolDefinition,
  ): boolean => {
    try {
      const edits = planUpsertCustomSymbolDefinition(project, definition);
      const committed = commitStructure("import-custom-symbol", edits);
      if (committed) {
        setStatus(`Imported symbol ${definition.symbol.name}`);
      }
      return committed;
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not import the custom symbol",
      );
      return false;
    }
  };

  /**
   * Rename one imported symbol's display name. The name lives inside the
   * embedded artwork, so this commits an artwork replacement that keeps the
   * definition identity — and every placed reference — untouched.
   */
  const renameCustomSymbol = (
    definitionId: string,
    inputName: string,
  ): boolean => {
    try {
      const edits = planRenameCustomSymbol(project, definitionId, inputName);
      if (edits.length === 0) return true;
      const committed = commitStructure("rename-custom-symbol", edits);
      if (committed) {
        setStatus(`Renamed symbol to ${inputName.trim()}`);
      }
      return committed;
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not rename the custom symbol",
      );
      return false;
    }
  };

  /**
   * Remove one imported symbol definition. A definition still placed anywhere
   * in the project is refused (matching the external-subcircuit guard), so a
   * removed symbol never leaves an unresolved instance behind.
   */
  const removeCustomSymbolDefinition = (definitionId: string): boolean => {
    try {
      const edits = planRemoveCustomSymbolDefinition(project, definitionId);
      const committed = commitStructure("remove-custom-symbol", edits);
      if (committed) {
        setStatus("Removed the imported symbol");
      }
      return committed;
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not remove the custom symbol",
      );
      return false;
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
    deleteCell,
    updateCellPinDirection,
    renameCellTerminal,
    editCellTerminalAnnotation,
    removeCellTerminalSelection,
    deleteCellTerminal,
    moveCellTerminal,
    setCellFormalParameters,
    setExternalSubcircuitDefinition,
    importCustomSymbolDefinition,
    renameCustomSymbol,
    removeCustomSymbolDefinition,
    setCellSymbolBodySize,
    setCellSymbolPortPlacement,
    renameProject,
  };
}
