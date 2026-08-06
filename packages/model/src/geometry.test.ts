import { describe, expect, it } from "vitest";

import {
  inverseTransformPoint,
  manhattanDistance,
  transformPoint,
} from "./geometry.js";
import type { Mirror, Rotation } from "./schema.js";

describe("integer coordinate transforms", () => {
  const rotations: Rotation[] = [0, 90, 180, 270];
  const mirrors: Mirror[] = ["none", "x"];

  it.each(
    rotations.flatMap((rotation) =>
      mirrors.map((mirror) => ({ mirror, rotation })),
    ),
  )("round-trips rotation $rotation and mirror $mirror", (orientation) => {
    const local = { x: 13, y: -7 };
    const origin = { x: 100, y: 80 };
    expect(
      inverseTransformPoint(
        transformPoint(local, origin, orientation),
        origin,
        orientation,
      ),
    ).toEqual(local);
  });

  it("computes Manhattan distance without geometry inference", () => {
    expect(manhattanDistance({ x: -5, y: 9 }, { x: 7, y: -3 })).toBe(24);
  });
});
