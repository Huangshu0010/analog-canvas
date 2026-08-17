import { describe, expect, it } from "vitest";

import { resolveRouteTap } from "./route-query.js";
import type { ResolvedRouteGeometry } from "./resolved-route-geometry.js";

function geometry(
  points: Array<{ x: number; y: number }>,
): ResolvedRouteGeometry {
  return {
    routeId: "route-1",
    netId: "net-1",
    centerline: points,
    segments: points.slice(0, -1).map((from, segmentIndex) => ({
      address: { routeId: "route-1", segmentIndex },
      from,
      to: points[segmentIndex + 1]!,
      mode: "manual" as const,
    })),
    vertices: points.map((point, index) => ({
      index,
      point,
      kind:
        index === 0 || index === points.length - 1
          ? ("junction" as const)
          : ("bend" as const),
    })),
    endpointJoins: [],
  };
}

describe("route queries", () => {
  it("prefers an in-tolerance interior vertex over a closer segment projection", () => {
    expect(
      resolveRouteTap(
        geometry([
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ]),
        { x: 100, y: 3 },
        10,
      ),
    ).toMatchObject({
      address: { routeId: "route-1", segmentIndex: 0 },
      point: { x: 100, y: 0 },
      distanceSquared: 9,
    });
  });

  it("projects to orthogonal segments, clamps endpoints, and rejects diagonals", () => {
    expect(
      resolveRouteTap(
        geometry([
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]),
        { x: 50, y: 6 },
        10,
      ),
    ).toMatchObject({ point: { x: 50, y: 0 }, distanceSquared: 36 });
    expect(
      resolveRouteTap(
        geometry([
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]),
        { x: 200, y: 0 },
        10,
      ),
    ).toBeNull();
    expect(
      resolveRouteTap(
        geometry([
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ]),
        { x: 50, y: 50 },
        10,
      ),
    ).toBeNull();
  });

  it("breaks equal-distance route hits by the lower segment index", () => {
    expect(
      resolveRouteTap(
        geometry([
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
          { x: 150, y: 0 },
        ]),
        { x: 75, y: 0 },
        30,
      )?.address,
    ).toEqual({ routeId: "route-1", segmentIndex: 0 });
  });
});
