import type {
  Point,
  RouteAnnotationAttachment,
  RouteBranch,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveEndpointPoint } from "./endpoint.js";

export type SegmentMode = RouteBranch["segmentModes"][number];

export interface RoutePolyline {
  routeId: string;
  netId: string;
  points: Point[];
  segmentModes: SegmentMode[];
}

export interface RouteAttachmentPlacement {
  position: Point;
  labelPosition: Point;
  rotation: 0 | 90 | 180 | 270;
}

export interface RoutedEndpointGeometry {
  point: Point;
  outward?: Point | null;
}

export interface OrthogonalEscapeRoute {
  points: Point[];
  waypoints: Point[];
  segmentModes: SegmentMode[];
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

export function routePolyline(
  document: SchematicDocument,
  resolver: SymbolResolver,
  route: RouteBranch,
): RoutePolyline | null {
  const from = resolveEndpointPoint(document, resolver, route.from);
  const to = resolveEndpointPoint(document, resolver, route.to);
  if (!from || !to) return null;
  return {
    routeId: route.id,
    netId: route.netId,
    points: [from, ...route.waypoints, to],
    segmentModes: [...route.segmentModes],
  };
}

/**
 * Resolves a visual annotation attachment against the current derived route
 * geometry. `t` survives segment stretching; the route remains electrically
 * untouched. An invalid segment is deliberately unresolved rather than
 * silently moving an annotation to a different conductor.
 */
export function routeAttachmentPlacement(
  polyline: RoutePolyline,
  attachment: RouteAnnotationAttachment,
): RouteAttachmentPlacement | null {
  const from = polyline.points[attachment.segmentIndex];
  const to = polyline.points[attachment.segmentIndex + 1];
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const position = {
    x: from.x + dx * attachment.t,
    y: from.y + dy * attachment.t,
  };
  const normal = { x: -dy / length, y: dx / length };
  const direction = attachment.direction === "forward" ? 1 : -1;
  const angle = Math.round(
    (Math.atan2(dy * direction, dx * direction) * 180) / Math.PI,
  );
  const rotation = ((angle % 360) + 360) % 360;
  if (
    rotation !== 0 &&
    rotation !== 90 &&
    rotation !== 180 &&
    rotation !== 270
  ) {
    return null;
  }
  return {
    position,
    labelPosition: {
      x: position.x + normal.x * attachment.normalOffset,
      y: position.y + normal.y * attachment.normalOffset,
    },
    rotation,
  };
}

export function isOrthogonal(points: readonly Point[]): boolean {
  return points.slice(1).every((point, index) => {
    const previous = points[index]!;
    return (
      !samePoint(previous, point) &&
      (previous.x === point.x || previous.y === point.y)
    );
  });
}

const MODE_PRIORITY: Record<SegmentMode, number> = {
  auto: 0,
  escape: 1,
  manual: 2,
  trunk: 3,
  locked: 4,
};

function strongerMode(left: SegmentMode, right: SegmentMode): SegmentMode {
  return MODE_PRIORITY[left] >= MODE_PRIORITY[right] ? left : right;
}

export function normalizeRouteGeometry(
  points: readonly Point[],
  segmentModes: readonly SegmentMode[],
): { points: Point[]; segmentModes: SegmentMode[] } {
  if (points.length < 2 || segmentModes.length !== points.length - 1) {
    throw new Error("Route normalization requires one mode per segment");
  }
  const normalizedPoints: Point[] = [{ ...points[0]! }];
  const normalizedModes: SegmentMode[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const mode = segmentModes[index - 1]!;
    if (samePoint(normalizedPoints.at(-1)!, point)) {
      if (normalizedModes.length > 0) {
        normalizedModes[normalizedModes.length - 1] = strongerMode(
          normalizedModes.at(-1)!,
          mode,
        );
      }
      continue;
    }
    normalizedPoints.push({ ...point });
    normalizedModes.push(mode);
    while (normalizedPoints.length >= 3) {
      const a = normalizedPoints.at(-3)!;
      const b = normalizedPoints.at(-2)!;
      const c = normalizedPoints.at(-1)!;
      if (!((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))) {
        break;
      }
      const mergedMode = strongerMode(
        normalizedModes.at(-2)!,
        normalizedModes.at(-1)!,
      );
      normalizedPoints.splice(-2, 1);
      normalizedModes.splice(-2, 2, mergedMode);
    }
  }
  return { points: normalizedPoints, segmentModes: normalizedModes };
}

function offsetPoint(point: Point, direction: Point, distance: number): Point {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
}

/**
 * Builds an orthogonal path whose first/last segment leaves a terminal in the
 * resolved outward pin direction. This is an Agent-side authoring helper; the
 * returned waypoints remain ordinary canonical Route geometry.
 */
export function buildOrthogonalEscapeRoute(
  from: RoutedEndpointGeometry,
  to: RoutedEndpointGeometry,
  escapeLength = 20,
  connectionGrid = 10,
): OrthogonalEscapeRoute {
  if (!Number.isInteger(escapeLength) || escapeLength <= 0) {
    throw new Error("Route escape length must be a positive integer");
  }
  if (!Number.isInteger(connectionGrid) || connectionGrid <= 0) {
    throw new Error("Route connection grid must be a positive integer");
  }
  const snapToConnectionGrid = (value: number) =>
    Math.round(value / connectionGrid) * connectionGrid;
  const rawPoints: Point[] = [{ ...from.point }];
  const rawModes: SegmentMode[] = [];
  const append = (point: Point, mode: SegmentMode) => {
    const previous = rawPoints.at(-1)!;
    if (previous.x === point.x && previous.y === point.y) return;
    rawPoints.push({ ...point });
    rawModes.push(mode);
  };

  const fromOutward = from.outward ?? null;
  const toOutward = to.outward ?? null;
  const fromEscape = fromOutward
    ? offsetPoint(from.point, fromOutward, escapeLength)
    : from.point;
  const toEscape = toOutward
    ? offsetPoint(to.point, toOutward, escapeLength)
    : to.point;
  if (fromOutward) append(fromEscape, "escape");

  const current = rawPoints.at(-1)!;
  const aligned = current.x === toEscape.x || current.y === toEscape.y;
  const fromWouldReverse =
    fromOutward !== null &&
    (toEscape.x - from.point.x) * fromOutward.x +
      (toEscape.y - from.point.y) * fromOutward.y <=
      0;
  const toWouldReverse =
    toOutward !== null &&
    (current.x - to.point.x) * toOutward.x +
      (current.y - to.point.y) * toOutward.y <=
      0;
  if (
    fromOutward &&
    toOutward &&
    !(aligned && !fromWouldReverse && !toWouldReverse)
  ) {
    if (fromOutward.x !== 0 && toOutward.x !== 0) {
      const middleY =
        fromEscape.y === toEscape.y
          ? fromEscape.y + escapeLength
          : snapToConnectionGrid((fromEscape.y + toEscape.y) / 2);
      append({ x: fromEscape.x, y: middleY }, "auto");
      append({ x: toEscape.x, y: middleY }, "auto");
    } else if (fromOutward.y !== 0 && toOutward.y !== 0) {
      const middleX =
        fromEscape.x === toEscape.x
          ? fromEscape.x + escapeLength
          : snapToConnectionGrid((fromEscape.x + toEscape.x) / 2);
      append({ x: middleX, y: fromEscape.y }, "auto");
      append({ x: middleX, y: toEscape.y }, "auto");
    } else if (fromOutward.x !== 0) {
      append({ x: fromEscape.x, y: toEscape.y }, "auto");
    } else {
      append({ x: toEscape.x, y: fromEscape.y }, "auto");
    }
  } else if (aligned && (fromWouldReverse || toWouldReverse)) {
    if (current.y === toEscape.y) {
      const detourY = current.y + escapeLength;
      append({ x: current.x, y: detourY }, "auto");
      append({ x: toEscape.x, y: detourY }, "auto");
    } else {
      const detourX = current.x + escapeLength;
      append({ x: detourX, y: current.y }, "auto");
      append({ x: detourX, y: toEscape.y }, "auto");
    }
  } else if (!aligned) {
    const bend = fromOutward
      ? fromOutward.x !== 0
        ? { x: current.x, y: toEscape.y }
        : { x: toEscape.x, y: current.y }
      : toOutward
        ? toOutward.x !== 0
          ? { x: toEscape.x, y: current.y }
          : { x: current.x, y: toEscape.y }
        : { x: toEscape.x, y: current.y };
    append(bend, "auto");
  }
  append(toEscape, "auto");
  if (toOutward) append(to.point, "escape");

  const normalized = normalizeRouteGeometry(rawPoints, rawModes);
  return {
    points: normalized.points,
    waypoints: normalized.points.slice(1, -1),
    segmentModes: normalized.segmentModes,
  };
}

export function moveRouteSegment(
  polyline: RoutePolyline,
  segmentIndex: number,
  target: Point,
): { waypoints: Point[]; segmentModes: SegmentMode[] } {
  if (segmentIndex < 0 || segmentIndex >= polyline.points.length - 1) {
    throw new Error(`Route segment index is out of range: ${segmentIndex}`);
  }
  const affectedModes = [
    polyline.segmentModes[segmentIndex - 1],
    polyline.segmentModes[segmentIndex],
    polyline.segmentModes[segmentIndex + 1],
  ].filter((mode): mode is SegmentMode => mode !== undefined);
  if (affectedModes.some((mode) => mode === "locked" || mode === "trunk")) {
    throw new Error("Route segment or its neighbor is protected");
  }

  const points = polyline.points.map((point) => ({ ...point }));
  const modes = [...polyline.segmentModes];
  const from = points[segmentIndex]!;
  const to = points[segmentIndex + 1]!;
  const horizontal = from.y === to.y;
  const lastSegmentIndex = points.length - 2;

  if (points.length === 2) {
    const moved = horizontal
      ? [
          points[0]!,
          { x: points[0]!.x, y: target.y },
          { x: points[1]!.x, y: target.y },
          points[1]!,
        ]
      : [
          points[0]!,
          { x: target.x, y: points[0]!.y },
          { x: target.x, y: points[1]!.y },
          points[1]!,
        ];
    const mode = modes[0] ?? "manual";
    const normalized = normalizeRouteGeometry(moved, [mode, mode, mode]);
    return {
      waypoints: normalized.points.slice(1, -1),
      segmentModes: normalized.segmentModes,
    };
  }

  if (segmentIndex === 0) {
    const fixedEndpoint = points[0]!;
    if (horizontal) {
      points[1]!.y = target.y;
      points.splice(1, 0, { x: fixedEndpoint.x, y: target.y });
    } else {
      points[1]!.x = target.x;
      points.splice(1, 0, { x: target.x, y: fixedEndpoint.y });
    }
    modes.splice(0, 1, modes[0]!, modes[0]!);
  } else if (segmentIndex === lastSegmentIndex) {
    const fixedEndpoint = points.at(-1)!;
    if (horizontal) {
      points[segmentIndex]!.y = target.y;
      points.splice(-1, 0, { x: fixedEndpoint.x, y: target.y });
    } else {
      points[segmentIndex]!.x = target.x;
      points.splice(-1, 0, { x: target.x, y: fixedEndpoint.y });
    }
    modes.splice(segmentIndex, 1, modes[segmentIndex]!, modes[segmentIndex]!);
  } else if (horizontal) {
    points[segmentIndex]!.y = target.y;
    points[segmentIndex + 1]!.y = target.y;
  } else {
    points[segmentIndex]!.x = target.x;
    points[segmentIndex + 1]!.x = target.x;
  }

  const normalized = normalizeRouteGeometry(points, modes);
  if (!isOrthogonal(normalized.points)) {
    throw new Error("Route segment move would make geometry non-orthogonal");
  }
  return {
    waypoints: normalized.points.slice(1, -1),
    segmentModes: normalized.segmentModes,
  };
}
