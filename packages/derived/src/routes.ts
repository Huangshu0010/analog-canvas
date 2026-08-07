import type {
  Point,
  RouteAnnotationAttachment,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { endpointKey, resolveEndpointPoint } from "./endpoint.js";

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

export interface Crossing {
  routeAId: string;
  routeBId: string;
  netAId: string;
  netBId: string;
  point: Point;
  kind: "crossing" | "overlap";
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
): OrthogonalEscapeRoute {
  if (!Number.isInteger(escapeLength) || escapeLength <= 0) {
    throw new Error("Route escape length must be a positive integer");
  }
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
          : Math.round((fromEscape.y + toEscape.y) / 2);
      append({ x: fromEscape.x, y: middleY }, "auto");
      append({ x: toEscape.x, y: middleY }, "auto");
    } else if (fromOutward.y !== 0 && toOutward.y !== 0) {
      const middleX =
        fromEscape.x === toEscape.x
          ? fromEscape.x + escapeLength
          : Math.round((fromEscape.x + toEscape.x) / 2);
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

function sharedExplicitEndpoint(
  left: RouteBranch,
  right: RouteBranch,
): RouteEndpoint | null {
  for (const leftEndpoint of [left.from, left.to]) {
    for (const rightEndpoint of [right.from, right.to]) {
      if (endpointKey(leftEndpoint) === endpointKey(rightEndpoint)) {
        return leftEndpoint;
      }
    }
  }
  return null;
}

function between(value: number, first: number, second: number): boolean {
  return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function segmentIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): { point: Point; kind: Crossing["kind"] } | null {
  const abHorizontal = a.y === b.y;
  const cdHorizontal = c.y === d.y;
  if (abHorizontal !== cdHorizontal) {
    const horizontalA = abHorizontal ? a : c;
    const horizontalB = abHorizontal ? b : d;
    const verticalA = abHorizontal ? c : a;
    const verticalB = abHorizontal ? d : b;
    const point = { x: verticalA.x, y: horizontalA.y };
    return between(point.x, horizontalA.x, horizontalB.x) &&
      between(point.y, verticalA.y, verticalB.y)
      ? { point, kind: "crossing" }
      : null;
  }
  if (abHorizontal && a.y === c.y) {
    const start = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    const end = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
    return start <= end
      ? { point: { x: start, y: a.y }, kind: "overlap" }
      : null;
  }
  if (!abHorizontal && a.x === c.x) {
    const start = Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
    const end = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
    return start <= end
      ? { point: { x: a.x, y: start }, kind: "overlap" }
      : null;
  }
  return null;
}

export function deriveCrossings(
  document: SchematicDocument,
  resolver: SymbolResolver,
): Crossing[] {
  const routes = [...document.routes].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  );
  const result: Crossing[] = [];
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < routes.length;
      rightIndex += 1
    ) {
      const left = routes[leftIndex]!;
      const right = routes[rightIndex]!;
      const leftPolyline = routePolyline(document, resolver, left);
      const rightPolyline = routePolyline(document, resolver, right);
      if (!leftPolyline || !rightPolyline) continue;
      const shared = sharedExplicitEndpoint(left, right);
      const sharedPoint = shared
        ? resolveEndpointPoint(document, resolver, shared)
        : null;
      for (let a = 1; a < leftPolyline.points.length; a += 1) {
        for (let b = 1; b < rightPolyline.points.length; b += 1) {
          const intersection = segmentIntersection(
            leftPolyline.points[a - 1]!,
            leftPolyline.points[a]!,
            rightPolyline.points[b - 1]!,
            rightPolyline.points[b]!,
          );
          if (!intersection) continue;
          if (sharedPoint && samePoint(sharedPoint, intersection.point))
            continue;
          result.push({
            routeAId: left.id,
            routeBId: right.id,
            netAId: left.netId,
            netBId: right.netId,
            point: intersection.point,
            kind: intersection.kind,
          });
        }
      }
    }
  }
  return result.sort(
    (left, right) =>
      left.routeAId.localeCompare(right.routeAId, "en") ||
      left.routeBId.localeCompare(right.routeBId, "en") ||
      left.point.x - right.point.x ||
      left.point.y - right.point.y,
  );
}
