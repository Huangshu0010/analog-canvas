import type { InsertLaunch } from "../features/component-insert/insert-launch";
import type {
  EditorTool,
  InteractionMode,
} from "../interaction/interaction-state";
import type { ScreenFlip } from "../interaction/shortcut-orientation";

export type EditorCommandRequest =
  | { id: "editor.cancel" }
  | { id: "history.undo" }
  | { id: "history.redo" }
  | { id: "selection.select-all" }
  | { id: "selection.clear" }
  | { id: "selection.delete" }
  | { id: "selection.copy" }
  | { id: "selection.move" }
  | { id: "transform.rotate"; deltaDegrees?: 90 | -90 }
  | { id: "transform.mirror"; direction: ScreenFlip }
  | { id: "insert.start"; launch: InsertLaunch }
  | { id: "insert.open" }
  | { id: "insert.free-net-port" }
  | { id: "tool.activate"; tool: EditorTool }
  | { id: "drafting.add-text" }
  | { id: "properties.open" }
  | { id: "properties.close" }
  | { id: "view.fit" };

export interface EditorCommandState {
  enabled: boolean;
  active: boolean;
  reason?: string;
}

export interface EditorCommandResult {
  status: "executed" | "rejected";
  message?: string;
}

export interface EditorCommandContext {
  interactionMode: InteractionMode;
  activeTool: EditorTool;
  hasDeletableSelection: boolean;
  hasMoveSelection: boolean;
  hasRotatableSelection: boolean;
  hasMirrorableSelection: boolean;
  hasInspectableSelection: boolean;
  propertiesOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  helpOpen: boolean;
  canvasDragActive: boolean;
  hasClearableDraftingSelection: boolean;
}

export interface EditorCommandOperations {
  closeHelp(): void;
  cancelCanvasDrag(): void;
  cancelInteraction(interactionMode: InteractionMode): void;
  clearDraftingSelection(): void;
  cancelPassive(): void;
  undo(): void;
  redo(): void;
  selectAll(): void;
  clearSelection(): void;
  deleteSelection(): void;
  beginCopy(): void;
  beginMove(): void;
  rotatePlacement(deltaDegrees: 90 | -90): void;
  rotateCopy(deltaDegrees: 90 | -90): void;
  rotateSelection(deltaDegrees: 90 | -90): void;
  mirrorPlacement(direction: ScreenFlip): void;
  mirrorCopy(direction: ScreenFlip): void;
  mirrorSelection(direction: ScreenFlip): void;
  startInsert(launch: InsertLaunch): void;
  openInsert(): void;
  placeFreeNetPort(): void;
  activateTool(tool: EditorTool): void;
  addText(): void;
  openProperties(): void;
  closeProperties(): void;
  fitView(): void;
  report(message: string): void;
}

export interface EditorCommandRouter {
  state(request: EditorCommandRequest): EditorCommandState;
  execute(request: EditorCommandRequest): EditorCommandResult;
}

type EditorCommandRouterOptions = {
  getContext(): EditorCommandContext;
  operations: EditorCommandOperations;
};

function enabled(active = false): EditorCommandState {
  return { enabled: true, active };
}

function disabled(reason: string): EditorCommandState {
  return { enabled: false, active: false, reason };
}

/**
 * Thin editor-local command plane. It owns cross-surface availability and
 * interaction arbitration, then delegates to the existing domain owners. It
 * deliberately knows nothing about Project JSON, Engine edits, geometry, or
 * electrical topology.
 */
export function createEditorCommandRouter(
  options: EditorCommandRouterOptions,
): EditorCommandRouter {
  const state = (request: EditorCommandRequest): EditorCommandState => {
    const context = options.getContext();
    switch (request.id) {
      case "editor.cancel":
        return enabled(
          context.helpOpen ||
            context.canvasDragActive ||
            context.interactionMode !== "idle" ||
            context.hasClearableDraftingSelection,
        );
      case "history.undo":
        return context.canUndo ? enabled() : disabled("Nothing to undo");
      case "history.redo":
        return context.canRedo ? enabled() : disabled("Nothing to redo");
      case "selection.select-all":
      case "selection.clear":
        return enabled();
      case "selection.delete":
        return context.hasDeletableSelection
          ? enabled()
          : disabled("Select an object before deleting it");
      case "selection.copy":
        if (
          context.interactionMode !== "idle" &&
          context.interactionMode !== "copy-placement"
        ) {
          return disabled("Finish or cancel the active tool before copying");
        }
        return enabled(context.interactionMode === "copy-placement");
      case "selection.move":
        if (
          context.interactionMode !== "idle" &&
          context.interactionMode !== "moving-selection"
        ) {
          return disabled("Finish or cancel the active tool before moving");
        }
        return context.hasMoveSelection ||
          context.interactionMode === "moving-selection"
          ? enabled(context.interactionMode === "moving-selection")
          : disabled("Select objects before moving them");
      case "transform.rotate":
        if (
          context.interactionMode === "placing-component" ||
          context.interactionMode === "copy-placement"
        ) {
          return enabled(true);
        }
        return context.interactionMode === "idle" &&
          context.hasRotatableSelection
          ? enabled()
          : disabled("Rotate is unavailable for the current interaction");
      case "transform.mirror":
        if (
          context.interactionMode === "placing-component" ||
          context.interactionMode === "copy-placement"
        ) {
          return enabled(true);
        }
        return context.interactionMode === "idle" &&
          context.hasMirrorableSelection
          ? enabled()
          : disabled("Mirror is unavailable for the current selection");
      case "insert.start":
      case "insert.open":
      case "insert.free-net-port":
        return enabled(
          context.interactionMode === "placing-component" ||
            context.interactionMode === "placing-vdd-rail",
        );
      case "tool.activate":
        return enabled(context.activeTool === request.tool);
      case "drafting.add-text":
      case "view.fit":
        return enabled();
      case "properties.open":
        return context.hasInspectableSelection
          ? enabled(context.propertiesOpen)
          : disabled("Select an object before opening Properties");
      case "properties.close":
        return enabled(context.propertiesOpen);
    }
  };

  const execute = (request: EditorCommandRequest): EditorCommandResult => {
    const availability = state(request);
    if (!availability.enabled) {
      const message = availability.reason ?? "Command is unavailable";
      // Undo, redo, and Delete historically no-op when invoked from a
      // shortcut with nothing to act on. Menus still consume the disabled
      // state, but the shared command must not add a new status-bar side
      // effect merely because routing was unified.
      if (
        request.id !== "history.undo" &&
        request.id !== "history.redo" &&
        request.id !== "selection.delete"
      ) {
        options.operations.report(message);
      }
      return { status: "rejected", message };
    }

    const context = options.getContext();
    switch (request.id) {
      case "editor.cancel":
        if (context.helpOpen) {
          options.operations.closeHelp();
        } else if (context.canvasDragActive) {
          options.operations.cancelCanvasDrag();
        } else if (context.interactionMode !== "idle") {
          options.operations.cancelInteraction(context.interactionMode);
        } else if (context.hasClearableDraftingSelection) {
          options.operations.clearDraftingSelection();
        } else {
          options.operations.cancelPassive();
        }
        break;
      case "history.undo":
        options.operations.undo();
        break;
      case "history.redo":
        options.operations.redo();
        break;
      case "selection.select-all":
        options.operations.selectAll();
        break;
      case "selection.clear":
        options.operations.clearSelection();
        break;
      case "selection.delete":
        options.operations.deleteSelection();
        break;
      case "selection.copy":
        options.operations.beginCopy();
        break;
      case "selection.move":
        options.operations.beginMove();
        break;
      case "transform.rotate": {
        const deltaDegrees = request.deltaDegrees ?? 90;
        if (context.interactionMode === "placing-component") {
          options.operations.rotatePlacement(deltaDegrees);
        } else if (context.interactionMode === "copy-placement") {
          options.operations.rotateCopy(deltaDegrees);
        } else {
          options.operations.rotateSelection(deltaDegrees);
        }
        break;
      }
      case "transform.mirror":
        if (context.interactionMode === "placing-component") {
          options.operations.mirrorPlacement(request.direction);
        } else if (context.interactionMode === "copy-placement") {
          options.operations.mirrorCopy(request.direction);
        } else {
          options.operations.mirrorSelection(request.direction);
        }
        break;
      case "insert.start":
        options.operations.startInsert(request.launch);
        break;
      case "insert.open":
        options.operations.openInsert();
        break;
      case "insert.free-net-port":
        options.operations.placeFreeNetPort();
        break;
      case "tool.activate":
        options.operations.activateTool(request.tool);
        break;
      case "drafting.add-text":
        options.operations.addText();
        break;
      case "properties.open":
        options.operations.openProperties();
        break;
      case "properties.close":
        options.operations.closeProperties();
        break;
      case "view.fit":
        options.operations.fitView();
        break;
    }
    return { status: "executed" };
  };

  return { state, execute };
}
