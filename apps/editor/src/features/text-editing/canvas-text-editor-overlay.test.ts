import { describe, expect, it } from "vitest";

import { resolveCanvasTextEditorFrame } from "./canvas-text-editor-overlay";

describe("canvas text editor frame", () => {
  it("uses the default editor size near the target", () => {
    expect(
      resolveCanvasTextEditorFrame(
        { x: 100, y: 200, width: 200, height: 30 },
        { x: 0, y: 0, width: 960, height: 640 },
        1,
      ),
    ).toEqual({ x: 94, y: 116, width: 420, height: 76 });
  });

  it("grows with text scale before reaching the viewport boundary", () => {
    const frame = resolveCanvasTextEditorFrame(
      { x: 100, y: 200, width: 200, height: 30 },
      { x: 0, y: 0, width: 960, height: 640 },
      3,
    );

    expect(frame.x).toBe(94);
    expect(frame.y).toBeCloseTo(83.5824);
    expect(frame.width).toBe(420);
    expect(frame.height).toBeCloseTo(108.4176);
  });

  it("clamps the frame to all four viewport edges", () => {
    expect(
      resolveCanvasTextEditorFrame(
        { x: -20, y: -10, width: 40, height: 20 },
        { x: 0, y: 0, width: 960, height: 640 },
        1,
      ),
    ).toEqual({ x: 8, y: 18, width: 420, height: 76 });

    expect(
      resolveCanvasTextEditorFrame(
        { x: 950, y: 630, width: 200, height: 50 },
        { x: 0, y: 0, width: 960, height: 640 },
        1,
      ),
    ).toEqual({ x: 532, y: 536, width: 420, height: 86 });
  });

  it("fits oversized content inside a translated viewport", () => {
    expect(
      resolveCanvasTextEditorFrame(
        { x: -100, y: -100, width: 1200, height: 800 },
        { x: 20, y: 30, width: 960, height: 640 },
        1,
      ),
    ).toEqual({ x: 28, y: 38, width: 944, height: 624 });
  });
});
