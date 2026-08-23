import { describe, expect, it } from "vitest";

import {
  IDENTITY_CANVAS_TRANSFORM,
  composeCanvasTransforms,
  quarterTurnTransform,
  reflectionTransform,
  transformCanvasPoint,
  translationTransform,
} from "./canvas-affine-transform";

describe("canvas affine transform", () => {
  it("composes orientation before pointer translation", () => {
    const pivot = { x: 20, y: 20 };
    const pose = composeCanvasTransforms(
      translationTransform({ x: 30, y: 10 }),
      quarterTurnTransform(pivot, 90),
    );
    expect(transformCanvasPoint(pose, { x: 30, y: 20 })).toEqual({
      x: 50,
      y: 40,
    });
  });

  it("four turns return to the original pose", () => {
    const pivot = { x: 20, y: 30 };
    let pose = IDENTITY_CANVAS_TRANSFORM;
    for (let index = 0; index < 4; index += 1) {
      pose = composeCanvasTransforms(quarterTurnTransform(pivot, 90), pose);
    }
    expect(transformCanvasPoint(pose, { x: 70, y: 40 })).toEqual({
      x: 70,
      y: 40,
    });
  });

  it("reflects around the selection axis", () => {
    expect(
      transformCanvasPoint(
        reflectionTransform({ x: 50, y: 40 }, "left-right"),
        { x: 70, y: 10 },
      ),
    ).toEqual({ x: 30, y: 10 });
  });
});
