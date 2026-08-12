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

  it("clears committed Wire geometry without leaving Wire mode", () => {
    let state = activateInteractionTool("wire");
    state = interactionReducer(state, {
      type: "set-wire-source",
      source: {
        endpoint: { kind: "junction", junctionId: "j1" },
        netId: "n1",
        point: { x: 10, y: 20 },
        preludeEdits: [],
      },
    });
    state = interactionReducer(state, {
      type: "set-wire-preview",
      point: { x: 30, y: 20 },
    });
    state = interactionReducer(state, {
      type: "set-wire-waypoints",
      update: [{ x: 20, y: 20 }],
    });

    expect(interactionReducer(state, { type: "complete-wire" })).toEqual({
      kind: "wire",
      source: null,
      previewPoint: null,
      waypoints: [],
    });
  });

  it("carries component parameters and annotation choices only while placing", () => {
    const state = interactionReducer(
      { kind: "idle" },
      {
        type: "place-component",
        placement: {
          symbolId: "nmos",
          properties: { w: "2u", l: "150n", m: "2" },
          initialRotation: 90,
          showReference: false,
          referenceText: "MIN",
        },
      },
    );
    expect(state).toEqual({
      kind: "placing-component",
      placement: {
        symbolId: "nmos",
        properties: { w: "2u", l: "150n", m: "2" },
        initialRotation: 90,
        showReference: false,
        referenceText: "MIN",
      },
    });
    expect(interactionReducer(state, { type: "cancel" })).toEqual({
      kind: "idle",
    });
  });
});
