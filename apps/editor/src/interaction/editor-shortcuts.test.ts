import { describe, expect, it } from "vitest";

import { resolveEditorShortcut, stepBoundedScale } from "./editor-shortcuts";
import type {
  EditorShortcutContext,
  EditorShortcutKey,
} from "./editor-shortcuts";

const baseContext: EditorShortcutContext = {
  isTyping: false,
  componentPlacementActive: false,
  hasRoutedMarkerSelection: false,
  hasRotatableSelection: false,
  hasDraftingSelection: false,
  wireReadyToFinish: false,
  draftingReadyToFinish: false,
  helpOpen: false,
  canvasDragActive: false,
  interactionActive: false,
  hasClearableDraftingSelection: false,
  hasRemovableWireWaypoint: false,
};

function key(
  value: string,
  modifiers: Partial<Omit<EditorShortcutKey, "key">> = {},
): EditorShortcutKey {
  return {
    key: value,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  };
}

function resolve(
  value: string,
  context: Partial<EditorShortcutContext> = {},
  modifiers: Partial<Omit<EditorShortcutKey, "key">> = {},
) {
  return resolveEditorShortcut(key(value, modifiers), {
    ...baseContext,
    ...context,
  });
}

describe("editor shortcut contract", () => {
  it("maps history and file chord shortcuts without stealing Meta chords", () => {
    expect(resolve("u")).toEqual({ kind: "undo" });
    expect(resolve("u", {}, { shiftKey: true })).toEqual({ kind: "redo" });
    expect(resolve("z", {}, { ctrlKey: true })).toEqual({ kind: "undo" });
    expect(resolve("z", {}, { ctrlKey: true, shiftKey: true })).toEqual({
      kind: "redo",
    });
    expect(resolve("s", {}, { ctrlKey: true })).toEqual({ kind: "save" });
    expect(resolve("s", {}, { metaKey: true })).toBeNull();
  });

  it("resolves R from selection context and preserves Shift rotation", () => {
    expect(resolve("r")).toEqual({
      kind: "activate-tool",
      tool: "rectangle",
    });
    expect(resolve("r", { hasRotatableSelection: true })).toEqual({
      kind: "rotate",
      deltaDegrees: 90,
    });
    expect(resolve("r", {}, { shiftKey: true })).toEqual({
      kind: "rotate",
      deltaDegrees: -90,
    });
  });

  it("opens insertion with I and gives placement rotation priority", () => {
    expect(resolve("i")).toEqual({ kind: "open-component-insert" });
    expect(
      resolve("r", {
        componentPlacementActive: true,
        hasRotatableSelection: true,
      }),
    ).toEqual({ kind: "rotate-placement", deltaDegrees: 90 });
    expect(
      resolve("r", { componentPlacementActive: true }, { shiftKey: true }),
    ).toEqual({ kind: "rotate-placement", deltaDegrees: -90 });
  });

  it("maps creation, mirror, fit, and marker commands", () => {
    expect(resolve("w")).toEqual({ kind: "activate-tool", tool: "wire" });
    expect(resolve("a")).toEqual({ kind: "activate-tool", tool: "arrow" });
    expect(resolve("l")).toEqual({
      kind: "activate-tool",
      tool: "construction-line",
    });
    expect(resolve("g")).toEqual({ kind: "activate-tool", tool: "guide" });
    expect(resolve("t")).toEqual({ kind: "add-text" });
    expect(resolve("f", {}, { shiftKey: true })).toEqual({
      kind: "mirror",
      direction: "top-bottom",
    });
    expect(resolve("Home")).toEqual({ kind: "fit-view" });
    expect(resolve("x", { hasRoutedMarkerSelection: true })).toEqual({
      kind: "reverse-current-marker",
    });
    expect(resolve("x")).toBeNull();
  });

  it("gives Ctrl+A selection precedence over the plain Arrow shortcut", () => {
    expect(resolve("a", {}, { ctrlKey: true })).toEqual({
      kind: "select-all",
    });
  });

  it("resolves style steps only for a drafting selection", () => {
    expect(resolve("]")).toBeNull();
    expect(resolve("]", { hasDraftingSelection: true })).toEqual({
      kind: "step-drafting-style",
      target: "stroke",
      increase: true,
    });
    expect(
      resolve("[", { hasDraftingSelection: true }, { shiftKey: true }),
    ).toEqual({
      kind: "step-drafting-style",
      target: "arrow-head",
      increase: false,
    });
    expect(stepBoundedScale(1, [0.75, 1, 1.5, 2] as const, true)).toBe(1.5);
    expect(stepBoundedScale(2, [0.75, 1, 1.5, 2] as const, true)).toBe(2);
  });

  it("finishes wire before drafting when both contexts are presented", () => {
    expect(
      resolve("Enter", {
        wireReadyToFinish: true,
        draftingReadyToFinish: true,
      }),
    ).toEqual({ kind: "finish-wire" });
    expect(resolve("Enter", { draftingReadyToFinish: true })).toEqual({
      kind: "finish-drafting",
    });
  });

  it("encodes contextual Escape priority in one place", () => {
    expect(
      resolve("Escape", {
        helpOpen: true,
        canvasDragActive: true,
        interactionActive: true,
        hasClearableDraftingSelection: true,
      }),
    ).toEqual({ kind: "close-help" });
    expect(
      resolve("Escape", {
        canvasDragActive: true,
        interactionActive: true,
      }),
    ).toEqual({ kind: "cancel-canvas-drag" });
    expect(resolve("Escape", { interactionActive: true })).toEqual({
      kind: "cancel-interaction",
    });
    expect(resolve("Escape", { hasClearableDraftingSelection: true })).toEqual({
      kind: "clear-drafting-selection",
    });
    expect(resolve("Escape")).toEqual({ kind: "cancel-passive" });
  });

  it("removes a pending wire bend before deleting selection", () => {
    expect(resolve("Delete", { hasRemovableWireWaypoint: true })).toEqual({
      kind: "remove-wire-waypoint",
    });
    expect(resolve("Backspace")).toEqual({ kind: "delete-selection" });
  });

  it("suppresses every global shortcut while typing", () => {
    for (const value of ["i", "r", "Escape", "Delete", "Enter"]) {
      expect(resolve(value, { isTyping: true })).toBeNull();
    }
    expect(resolve("s", { isTyping: true }, { ctrlKey: true })).toBeNull();
  });
});
