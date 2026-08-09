import type { Point } from "@icm/model";
import { normalizeRouteGeometry, type SegmentMode } from "@icm/derived";

export interface WireEndpointGeometry {
  point: Point;
}

export interface ManualWirePath {
  points: Point[];
  waypoints: Point[];
  segmentModes: SegmentMode[];
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function append(
  points: Point[],
  modes: SegmentMode[],
  point: Point,
  mode: SegmentMode,
): void {
  if (samePoint(points.at(-1)!, point)) return;
  points.push({ ...point });
  modes.push(mode);
}

/**
 * Appends a deterministic orthogonal connection without offsetting either
 * endpoint. Direct terminal corners are intentional in manual editing; the
 * renderer supplies their visual miter bridge separately.
 */
function appendOrthogonal(
  points: Point[],
  modes: SegmentMode[],
  target: Point,
  mode: SegmentMode,
): void {
  const last = points.at(-1)!;
  if (samePoint(last, target)) return;
  if (last.x !== target.x && last.y !== target.y) {
    const previous = points.at(-2);
    const departHorizontally = previous ? previous.y === last.y : true;
    append(
      points,
      modes,
      departHorizontally
        ? { x: target.x, y: last.y }
        : { x: last.x, y: target.y },
      mode,
    );
  }
  append(points, modes, target, mode);
}

/**
 * Produces the UI's persisted route geometry. Electrical endpoints remain the
 * exact clicked pin origins; no invisible terminal escape is added.
 */
export function buildManualWirePath(
  from: WireEndpointGeometry,
  to: WireEndpointGeometry,
  manualWaypoints: readonly Point[] = [],
): ManualWirePath {
  const points: Point[] = [{ ...from.point }];
  const modes: SegmentMode[] = [];

  for (const waypoint of manualWaypoints) {
    appendOrthogonal(points, modes, waypoint, "manual");
  }
  appendOrthogonal(points, modes, to.point, "manual");

  // The editor briefly previews a new wire at its own source pin. That is a
  // valid zero-length interaction state, but not a RouteBranch to normalize or
  // persist.
  if (points.length === 1) {
    return { points, waypoints: [], segmentModes: [] };
  }

  const normalized = normalizeRouteGeometry(points, modes);
  return {
    points: normalized.points,
    waypoints: normalized.points.slice(1, -1),
    segmentModes: normalized.segmentModes,
  };
}
