import type { Point } from "@icm/model";
import { describe, expect, it } from "vitest";

import { resolveRouteTap } from "./route-tap";

describe("resolveRouteTap", () => {
  it("prefers an in-tolerance interior vertex over a closer segment projection", () => {
    // Route bends at {100,0}. The pointer is on segment 1 (dist 0 by projection)
    // but within tolerance of the bend vertex, so the vertex wins.
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const tap = resolveRouteTap(points, { x: 100, y: 3 }, 10);
    expect(tap).toEqual({
      segmentIndex: 0,
      point: { x: 100, y: 0 },
      distanceSquared: 9,
    });
  });

  it("projects onto a horizontal segment clamped to its bounds", () => {
    const tap = resolveRouteTap(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { x: 50, y: 6 },
      10,
    );
    expect(tap).toEqual({
      segmentIndex: 0,
      point: { x: 50, y: 0 },
      distanceSquared: 36,
    });
  });

  it("projects onto a vertical segment clamped to its bounds", () => {
    const tap = resolveRouteTap(
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ],
      { x: 8, y: 50 },
      10,
    );
    expect(tap).toEqual({
      segmentIndex: 0,
      point: { x: 0, y: 50 },
      distanceSquared: 64,
    });
  });

  it("clamps projection past the segment end to the endpoint", () => {
    // Pointer far past the right end projects to the endpoint {100,0}, which is
    // out of tolerance, so the result is null.
    expect(
      resolveRouteTap(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        { x: 200, y: 0 },
        10,
      ),
    ).toBeNull();
  });

  it("breaks distance ties by the lower segment index at a vertex", () => {
    // Pointer {75,0} is equidistant (25) from interior vertices {50,0} (seg 0)
    // and {100,0} (seg 1); the lower segment index wins.
    const tap = resolveRouteTap(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 0 },
      ],
      { x: 75, y: 0 },
      30,
    );
    expect(tap?.segmentIndex).toBe(0);
    expect(tap?.point).toEqual({ x: 50, y: 0 });
  });

  it("skips diagonal segments and returns null when nothing is in tolerance", () => {
    expect(
      resolveRouteTap(
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        { x: 50, y: 50 },
        10,
      ),
    ).toBeNull();
  });
});
