import type { EditorTool } from "./interaction-state";
import type { ScreenFlip } from "./shortcut-orientation";

export interface EditorShortcutKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface EditorShortcutContext {
  isTyping: boolean;
  hasRoutedMarkerSelection: boolean;
  hasRotatableSelection: boolean;
  hasDraftingSelection: boolean;
  wireReadyToFinish: boolean;
  draftingReadyToFinish: boolean;
  helpOpen: boolean;
  canvasDragActive: boolean;
  interactionActive: boolean;
  hasClearableDraftingSelection: boolean;
  hasRemovableWireWaypoint: boolean;
}

export type EditorShortcutIntent =
  | { kind: "undo" | "redo" }
  | { kind: "copy" | "paste" | "save" | "open" | "select-all" }
  | { kind: "reverse-current-marker" }
  | { kind: "rotate"; deltaDegrees: 90 | -90 }
  | { kind: "activate-tool"; tool: EditorTool }
  | { kind: "add-text" }
  | { kind: "mirror"; direction: ScreenFlip }
  | { kind: "fit-view" }
  | {
      kind: "step-drafting-style";
      target: "stroke" | "arrow-head";
      increase: boolean;
    }
  | { kind: "finish-wire" | "finish-drafting" }
  | {
      kind:
        | "close-help"
        | "cancel-canvas-drag"
        | "cancel-interaction"
        | "clear-drafting-selection"
        | "cancel-passive";
    }
  | { kind: "remove-wire-waypoint" | "delete-selection" };

export function stepBoundedScale<T extends number>(
  current: T,
  steps: readonly T[],
  increase: boolean,
): T {
  const index = steps.indexOf(current);
  const next = increase ? index + 1 : index - 1;
  const clamped = Math.max(0, Math.min(steps.length - 1, next < 0 ? 0 : next));
  return steps[clamped]!;
}

export function resolveEditorShortcut(
  event: EditorShortcutKey,
  context: EditorShortcutContext,
): EditorShortcutIntent | null {
  if (context.isTyping) return null;

  const key = event.key.toLowerCase();
  const plain = !event.ctrlKey && !event.metaKey && !event.altKey;

  if (plain && key === "u") {
    return { kind: event.shiftKey ? "redo" : "undo" };
  }
  if (event.ctrlKey && key === "z") {
    return { kind: event.shiftKey ? "redo" : "undo" };
  }
  if (event.ctrlKey && key === "y") return { kind: "redo" };
  if (event.ctrlKey && key === "c") return { kind: "copy" };
  if (event.ctrlKey && key === "v") return { kind: "paste" };
  if (event.ctrlKey && key === "s") return { kind: "save" };
  if (event.ctrlKey && key === "o") return { kind: "open" };
  if (event.ctrlKey && key === "a") return { kind: "select-all" };

  if (plain && key === "x" && context.hasRoutedMarkerSelection) {
    return { kind: "reverse-current-marker" };
  }
  if (plain && key === "r") {
    return event.shiftKey
      ? { kind: "rotate", deltaDegrees: -90 }
      : context.hasRotatableSelection
        ? { kind: "rotate", deltaDegrees: 90 }
        : { kind: "activate-tool", tool: "rectangle" };
  }
  if (plain && key === "w") {
    return { kind: "activate-tool", tool: "wire" };
  }
  if (plain && key === "t") return { kind: "add-text" };
  if (plain && key === "a") {
    return { kind: "activate-tool", tool: "arrow" };
  }
  if (plain && key === "l") {
    return { kind: "activate-tool", tool: "construction-line" };
  }
  if (plain && key === "g") {
    return { kind: "activate-tool", tool: "guide" };
  }
  if (plain && key === "f") {
    return {
      kind: "mirror",
      direction: event.shiftKey ? "top-bottom" : "left-right",
    };
  }
  if (plain && key === "home") return { kind: "fit-view" };
  if (
    plain &&
    (event.key === "[" || event.key === "]") &&
    context.hasDraftingSelection
  ) {
    return {
      kind: "step-drafting-style",
      target: event.shiftKey ? "arrow-head" : "stroke",
      increase: event.key === "]",
    };
  }
  if (event.key === "Enter" && context.wireReadyToFinish) {
    return { kind: "finish-wire" };
  }
  if (event.key === "Enter" && context.draftingReadyToFinish) {
    return { kind: "finish-drafting" };
  }
  if (event.key === "Escape") {
    if (context.helpOpen) return { kind: "close-help" };
    if (context.canvasDragActive) return { kind: "cancel-canvas-drag" };
    if (context.interactionActive) return { kind: "cancel-interaction" };
    if (context.hasClearableDraftingSelection) {
      return { kind: "clear-drafting-selection" };
    }
    return { kind: "cancel-passive" };
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    return context.hasRemovableWireWaypoint
      ? { kind: "remove-wire-waypoint" }
      : { kind: "delete-selection" };
  }
  return null;
}
