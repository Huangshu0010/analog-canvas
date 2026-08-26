import { describe, expect, it } from "vitest";

import {
  classifyCanvasGestureStart,
  type CanvasGestureStartContext,
  type PanPreview,
  updateCanvasPan,
} from "./canvas-gesture-model";

const startContext: CanvasGestureStartContext = {
  button: 0,
  altKey: false,
  interactionKind: "selecting",
  targetIsCanvas: true,
  placementPending: false,
  vddRailMode: false,
  copyPlacementPending: false,
  tool: "pointer",
};

describe("canvas gesture model", () => {
  it("reserves left click for an active placement or drafting tool", () => {
    expect(
      classifyCanvasGestureStart({ ...startContext, placementPending: true }),
    ).toBeNull();
    expect(
      classifyCanvasGestureStart({ ...startContext, tool: "wire" }),
    ).toBeNull();
  });

  it("classifies middle pan and both frame-zoom entry gestures", () => {
    expect(classifyCanvasGestureStart({ ...startContext, button: 1 })).toBe(
      "pan",
    );
    expect(classifyCanvasGestureStart({ ...startContext, button: 2 })).toBe(
      "zoom",
    );
    expect(classifyCanvasGestureStart({ ...startContext, altKey: true })).toBe(
      "zoom",
    );
  });

  it("does not pan until the screen-space slop is crossed", () => {
    const preview: PanPreview = {
      clientStart: { x: 100, y: 100 },
      viewBoxStart: { x: 0, y: 0, width: 800, height: 400 },
      pointerId: 1,
      dragged: false,
    };

    expect(
      updateCanvasPan(
        preview,
        { x: 106, y: 100 },
        { width: 400, height: 200 },
        10,
      ),
    ).toBeNull();
    expect(
      updateCanvasPan(
        preview,
        { x: 110, y: 105 },
        { width: 400, height: 200 },
        10,
      ),
    ).toEqual({
      preview: { ...preview, dragged: true },
      viewBox: { x: -20, y: -10, width: 800, height: 400 },
    });
  });
});
