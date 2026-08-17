import type { EditorTool, InteractionMode } from "./interaction-state";
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
  interactionMode: InteractionMode;
  hasRoutedMarkerSelection: boolean;
  hasRotatableSelection: boolean;
  hasDraftingSelection: boolean;
  hasInspectableSelection: boolean;
  hasMoveSelection: boolean;
  hasRouteSelection: boolean;
  hasHighlightableNet: boolean;
  wireReadyToFinish: boolean;
  draftingReadyToFinish: boolean;
  helpOpen: boolean;
  canvasDragActive: boolean;
  hasClearableDraftingSelection: boolean;
  hasRemovableWireWaypoint: boolean;
  propertiesOpen: boolean;
  hasHierarchyEnterSelection: boolean;
  canReturnToParent: boolean;
}

export type EditorShortcutIntent =
  | { kind: "block-browser-refresh" }
  | { kind: "block-browser-bookmark" }
  | { kind: "undo" | "redo" }
  | { kind: "copy" | "save" | "open" | "select-all" | "clear-selection" }
  | { kind: "begin-selection-move" | "move-selection-required" }
  | { kind: "reverse-current-marker" }
  | { kind: "open-component-insert" }
  | { kind: "place-port" }
  | { kind: "rotate-placement"; deltaDegrees: 90 | -90 }
  | { kind: "rotate-copy-placement"; deltaDegrees: 90 | -90 }
  | { kind: "mirror-placement"; direction: ScreenFlip }
  | { kind: "mirror-copy-placement"; direction: ScreenFlip }
  | { kind: "rotate"; deltaDegrees: 90 | -90 }
  | { kind: "activate-tool"; tool: EditorTool }
  | { kind: "add-text" }
  | {
      kind:
        "open-properties" | "close-properties" | "property-selection-required";
    }
  | { kind: "edit-net-label" | "net-label-selection-required" }
  | { kind: "toggle-net-highlight" }
  | {
      kind:
        "enter-hierarchy" | "return-to-parent" | "hierarchy-selection-required";
    }
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
  | { kind: "remove-wire-waypoint" | "delete-selection" }
  | { kind: "blocked-interaction-command"; command: string };

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
  const key = event.key.toLowerCase();
  const commandModifier = event.ctrlKey || event.metaKey;
  if (event.key === "F5") return { kind: "block-browser-refresh" };
  if (commandModifier && key === "r") {
    if (context.isTyping) return { kind: "block-browser-refresh" };
    if (
      context.interactionMode === "placing-component" ||
      context.interactionMode === "copy-placement"
    ) {
      return context.interactionMode === "placing-component"
        ? { kind: "mirror-placement", direction: "top-bottom" }
        : { kind: "mirror-copy-placement", direction: "top-bottom" };
    }
    if (context.interactionMode !== "idle") {
      return { kind: "block-browser-refresh" };
    }
    return context.hasRotatableSelection
      ? { kind: "mirror", direction: "top-bottom" }
      : { kind: "block-browser-refresh" };
  }
  if (commandModifier && key === "d") {
    if (context.isTyping) return { kind: "block-browser-bookmark" };
    return context.interactionMode === "idle"
      ? { kind: "clear-selection" }
      : { kind: "block-browser-bookmark" };
  }

  if (context.isTyping) return null;

  const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
  const interactionActive = context.interactionMode !== "idle";

  if (plain && key === "u") {
    return { kind: event.shiftKey ? "redo" : "undo" };
  }
  if (event.ctrlKey && key === "z") {
    return { kind: event.shiftKey ? "redo" : "undo" };
  }
  if (event.ctrlKey && key === "y") return { kind: "redo" };
  if (event.ctrlKey && key === "s") return { kind: "save" };
  if (event.ctrlKey && key === "o") return { kind: "open" };

  if (event.key === "Escape") {
    if (context.helpOpen) return { kind: "close-help" };
    if (context.canvasDragActive) return { kind: "cancel-canvas-drag" };
    if (interactionActive) return { kind: "cancel-interaction" };
    if (context.hasClearableDraftingSelection) {
      return { kind: "clear-drafting-selection" };
    }
    return { kind: "cancel-passive" };
  }

  if (interactionActive) {
    if (event.ctrlKey && key === "a") {
      return { kind: "blocked-interaction-command", command: "Select All" };
    }
    if (plain && key === "c") {
      return context.interactionMode === "copy-placement"
        ? { kind: "copy" }
        : { kind: "blocked-interaction-command", command: "Copy" };
    }
    if (plain && key === "m") {
      return context.interactionMode === "moving-selection"
        ? { kind: "begin-selection-move" }
        : { kind: "blocked-interaction-command", command: "Move" };
    }
    if (plain && key === "i") return { kind: "open-component-insert" };
    if (plain && key === "w") {
      return { kind: "activate-tool", tool: "wire" };
    }
    if (plain && key === "a") {
      return { kind: "activate-tool", tool: "arrow" };
    }
    if (plain && key === "k") {
      return { kind: "activate-tool", tool: "construction-line" };
    }
    if (
      plain &&
      event.shiftKey &&
      key === "r" &&
      (context.interactionMode === "placing-component" ||
        context.interactionMode === "copy-placement")
    ) {
      return context.interactionMode === "placing-component"
        ? { kind: "mirror-placement", direction: "left-right" }
        : { kind: "mirror-copy-placement", direction: "left-right" };
    }
    if (plain && key === "r") {
      if (context.interactionMode === "placing-component") {
        return { kind: "rotate-placement", deltaDegrees: 90 };
      }
      if (context.interactionMode === "copy-placement") {
        return { kind: "rotate-copy-placement", deltaDegrees: 90 };
      }
      if (!event.shiftKey) return { kind: "activate-tool", tool: "rectangle" };
    }
    if (plain && key === "f" && !event.shiftKey) {
      return { kind: "fit-view" };
    }
    if (plain && key === "home") return { kind: "fit-view" };
    if (event.key === "Enter" && context.wireReadyToFinish) {
      return { kind: "finish-wire" };
    }
    if (event.key === "Enter" && context.draftingReadyToFinish) {
      return { kind: "finish-drafting" };
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      context.hasRemovableWireWaypoint
    ) {
      return { kind: "remove-wire-waypoint" };
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      context.interactionMode === "wire" &&
      context.hasInspectableSelection
    ) {
      return { kind: "delete-selection" };
    }
    const blockedCommands: Record<string, string> = {
      c: "Copy",
      q: "Properties",
      l: "Net Label",
      m: "Move",
      t: "Text",
      h: "Net Highlight",
      x: "Current Marker",
      e: "Enter Cell",
      r: "Rotate or Mirror",
      "[": "Drafting Style",
      "]": "Drafting Style",
      delete: "Delete",
      backspace: "Delete",
    };
    const command = blockedCommands[key];
    return command ? { kind: "blocked-interaction-command", command } : null;
  }

  if (event.ctrlKey && key === "a") return { kind: "select-all" };

  if (plain && key === "e") {
    if (event.shiftKey) {
      return context.canReturnToParent ? { kind: "return-to-parent" } : null;
    }
    return context.hasHierarchyEnterSelection
      ? { kind: "enter-hierarchy" }
      : { kind: "hierarchy-selection-required" };
  }

  if (plain && key === "x" && context.hasRoutedMarkerSelection) {
    return { kind: "reverse-current-marker" };
  }
  if (plain && key === "c") return { kind: "copy" };
  if (plain && key === "m") {
    return context.hasMoveSelection
      ? { kind: "begin-selection-move" }
      : { kind: "move-selection-required" };
  }
  if (plain && key === "i") return { kind: "open-component-insert" };
  if (plain && key === "p") return { kind: "place-port" };
  if (plain && key === "r") {
    if (context.interactionMode === "placing-component") {
      return {
        kind: "rotate-placement",
        deltaDegrees: 90,
      };
    }
    if (event.shiftKey) {
      return context.hasRotatableSelection
        ? { kind: "mirror", direction: "left-right" }
        : null;
    }
    return context.hasRotatableSelection
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
  if (plain && key === "l" && context.interactionMode !== "wire") {
    return context.hasRouteSelection
      ? { kind: "edit-net-label" }
      : { kind: "net-label-selection-required" };
  }
  if (plain && key === "h" && context.hasHighlightableNet) {
    return { kind: "toggle-net-highlight" };
  }
  if (plain && key === "k") {
    return { kind: "activate-tool", tool: "construction-line" };
  }
  if (plain && key === "q") {
    if (context.propertiesOpen) return { kind: "close-properties" };
    return context.hasInspectableSelection
      ? { kind: "open-properties" }
      : { kind: "property-selection-required" };
  }
  if (plain && key === "f" && !event.shiftKey) return { kind: "fit-view" };
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
  if (event.key === "Delete" || event.key === "Backspace") {
    return context.hasRemovableWireWaypoint
      ? { kind: "remove-wire-waypoint" }
      : { kind: "delete-selection" };
  }
  return null;
}
