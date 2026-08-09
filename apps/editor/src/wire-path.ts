import type { Point } from "@icm/model";
import {
  buildOrthogonalEscapeRoute,
  normalizeRouteGeometry,
  type SegmentMode,
} from "@icm/derived";

export interface WireEndpointGeometry {
  point: Point;
  /** Unit vector pointing away from a component terminal, when applicable. */
  outward?: Point;
}

export interface ManualWirePath {
  points: Point[];
  waypoints: Point[];
  segmentModes: SegmentMode[];
}

const TERMINAL_ESCAPE_LENGTH = 10;

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
 * Appends a deterministic orthogonal connection without changing its endpoints.
 * Once a terminal escape has been appended, its direction becomes the first
 * preferred axis for the next corner.
 */
function appendOrthogonal(
  points: Point[],
  modes: SegmentMode[],
  target: Point,
  mode: SegmentMode,
  preferredArrivalAxis?: "horizontal" | "vertical",
  forceTurnAfterFirstEscape = false,
): void {
  const last = points.at(-1)!;
  if (samePoint(last, target)) return;
  if (last.x !== target.x && last.y !== target.y) {
    const previous = points.at(-2);
    const departHorizontally = previous
      ? forceTurnAfterFirstEscape && points.length === 2
        ? previous.x === last.x
        : previous.y === last.y
      : preferredArrivalAxis === "vertical"
        ? false
        : true;
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

function escaped(point: Point, outward: Point): Point {
  return {
    x: point.x + outward.x * TERMINAL_ESCAPE_LENGTH,
    y: point.y + outward.y * TERMINAL_ESCAPE_LENGTH,
  };
}

/**
 * Produces the UI's persisted route geometry. Electrical endpoints stay at the
 * exact pin origins; only the route's first and last segments are constrained
 * to leave/approach a component along its outward pin direction.
 */
export function buildManualWirePath(
  from: WireEndpointGeometry,
  to: WireEndpointGeometry,
  manualWaypoints: readonly Point[] = [],
  connectionGrid = 10,
): ManualWirePath {
  // Keep the one-click terminal-to-terminal case exactly aligned with the
  // engine's pin-aware router. In particular, it inserts a legal detour when
  // two terminal outward directions would otherwise force an immediate U-turn.
  if (manualWaypoints.length === 0) {
    const escapedRoute = buildOrthogonalEscapeRoute(
      from,
      to,
      TERMINAL_ESCAPE_LENGTH,
      connectionGrid,
    );
    return {
      points: escapedRoute.points,
      waypoints: escapedRoute.waypoints,
      segmentModes: escapedRoute.segmentModes,
    };
  }
  const points: Point[] = [{ ...from.point }];
  const modes: SegmentMode[] = [];
  if (from.outward)
    append(points, modes, escaped(from.point, from.outward), "escape");

  for (const waypoint of manualWaypoints) {
    appendOrthogonal(
      points,
      modes,
      waypoint,
      "manual",
      undefined,
      Boolean(from.outward),
    );
  }

  const targetEscape = to.outward ? escaped(to.point, to.outward) : to.point;
  appendOrthogonal(
    points,
    modes,
    targetEscape,
    "manual",
    to.outward?.x === 0 ? "vertical" : "horizontal",
    Boolean(from.outward),
  );
  if (to.outward) append(points, modes, to.point, "escape");

  const normalized = normalizeRouteGeometry(points, modes);
  return {
    points: normalized.points,
    waypoints: normalized.points.slice(1, -1),
    segmentModes: normalized.segmentModes,
  };
}
