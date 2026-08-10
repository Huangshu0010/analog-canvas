import { describe, expect, it } from "vitest";

import {
  activateInteractionTool,
  interactionReducer,
  interactionTool,
} from "./interaction-state";

describe("editor interaction state", () => {
  it("makes creation modes mutually exclusive", () => {
    const drawing = activateInteractionTool("arrow");
    expect(drawing.kind).toBe("drawing");

    const wiring = interactionReducer(drawing, {
      type: "activate-tool",
      tool: "wire",
    });
    expect(wiring).toEqual({
      kind: "wire",
      source: null,
      previewPoint: null,
      waypoints: [],
    });
    expect(interactionTool(wiring)).toBe("wire");
  });

  it("cancels every creation mode to one idle state", () => {
    for (const tool of [
      "wire",
      "guide",
      "construction-line",
      "arrow",
      "rectangle",
    ] as const) {
      expect(
        interactionReducer(activateInteractionTool(tool), { type: "cancel" }),
      ).toEqual({ kind: "idle" });
    }
  });

  it("clears drawing geometry without leaving the active drawing tool", () => {
    let state = activateInteractionTool("construction-line");
    state = interactionReducer(state, {
      type: "set-drawing-source",
      point: { x: 10, y: 20 },
    });
    state = interactionReducer(state, {
      type: "set-drawing-waypoints",
      update: [{ x: 30, y: 20 }],
    });
    state = interactionReducer(state, { type: "clear-drawing" });

    expect(state).toEqual({
      kind: "drawing",
      tool: "construction-line",
      source: null,
      hover: null,
      waypoints: [],
      snapPoint: null,
    });
  });
});
