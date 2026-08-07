import { describe, expect, it } from "vitest";

import { moveRouteSegment, routeAttachmentPlacement } from "./routes.js";
import type { RoutePolyline } from "./routes.js";

describe("direct route segment movement", () => {
  it("turns a direct segment into a stable orthogonal dogleg", () => {
    expect(
      moveRouteSegment(
        {
          routeId: "route-1",
          netId: "net-1",
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          segmentModes: ["manual"],
        },
        0,
        { x: 50, y: 30 },
      ),
    ).toEqual({
      waypoints: [
        { x: 0, y: 30 },
        { x: 100, y: 30 },
      ],
      segmentModes: ["manual", "manual", "manual"],
    });
  });

  it("moves only an interior segment and rejects protected neighbors", () => {
    const polyline: RoutePolyline = {
      routeId: "route-1",
      netId: "net-1",
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 40 },
        { x: 80, y: 40 },
      ],
      segmentModes: ["manual", "manual", "manual"],
    };
    expect(moveRouteSegment(polyline, 1, { x: 35, y: 20 })).toEqual({
      waypoints: [
        { x: 35, y: 0 },
        { x: 35, y: 40 },
      ],
      segmentModes: ["manual", "manual", "manual"],
    });
    expect(() =>
      moveRouteSegment(
        { ...polyline, segmentModes: ["locked", "manual", "manual"] },
        1,
        { x: 35, y: 20 },
      ),
    ).toThrow("protected");
  });

  it("keeps a current-arrow attachment at the same route fraction after a stretch", () => {
    const attachment = {
      routeId: "route-1",
      segmentIndex: 0,
      t: 0.25,
      direction: "reverse" as const,
      normalOffset: -14,
    };
    expect(
      routeAttachmentPlacement(
        {
          routeId: "route-1",
          netId: "net-1",
          points: [
            { x: 0, y: 20 },
            { x: 200, y: 20 },
          ],
          segmentModes: ["manual"],
        },
        attachment,
      ),
    ).toEqual({
      position: { x: 50, y: 20 },
      labelPosition: { x: 50, y: 6 },
      rotation: 180,
    });
  });
});
