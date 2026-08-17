import type {
  Point,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { endpointKey, resolveEndpointPoint } from "./endpoint.js";

import type {
  ResolvedDocumentRoutingGeometry,
  ResolvedRouteGeometry,
  ResolvedRouteSegment,
  RouteSegmentAddress,
} from "./resolved-route-geometry.js";
import { resolveDocumentRoutingGeometry } from "./resolved-route-geometry.js";

export interface RouteSegmentHit {
  address: RouteSegmentAddress;
  point: Point;
  t: number;
  distanceSquared: number;
}

export interface Crossing {
  routeAId: string;
  routeBId: string;
  netAId: string;
  netBId: string;
  point: Point;
  kind: "crossing" | "overlap";
}

function isAxisAligned(segment: ResolvedRouteSegment): boolean {
  return (
    (segment.from.x === segment.to.x || segment.from.y === segment.to.y) &&
    (segment.from.x !== segment.to.x || segment.from.y !== segment.to.y)
  );
}

export function projectPointToRouteSegment(
  point: Point,
  segment: ResolvedRouteSegment,
): RouteSegmentHit | null {
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return null;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) /
        lengthSquared,
    ),
  );
  const projected = {
    x: segment.from.x + dx * t,
    y: segment.from.y + dy * t,
  };
  return {
    address: segment.address,
    point: projected,
    t,
    distanceSquared:
      (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2,
  };
}

export function nearestRouteSegment(
  geometry: ResolvedRouteGeometry,
  point: Point,
): RouteSegmentHit | null {
  return (
    geometry.segments
      .flatMap((segment) => {
        const hit = projectPointToRouteSegment(point, segment);
        return hit ? [hit] : [];
      })
      .sort(
        (left, right) =>
          left.distanceSquared - right.distanceSquared ||
          left.address.segmentIndex - right.address.segmentIndex,
      )[0] ?? null
  );
}

/**
 * Preserve the editor's bend-first route hit behavior. A bend belongs to the
 * preceding segment; otherwise the nearest in-tolerance orthogonal segment
 * wins, with the lower segment index as the deterministic tie-break.
 */
export function resolveRouteTap(
  geometry: ResolvedRouteGeometry,
  pointer: Point,
  tolerance: number,
): RouteSegmentHit | null {
  const toleranceSquared = tolerance * tolerance;
  const vertex = geometry.vertices
    .slice(1, -1)
    .map((candidate) => {
      const distanceSquared =
        (pointer.x - candidate.point.x) ** 2 +
        (pointer.y - candidate.point.y) ** 2;
      return {
        address: {
          routeId: geometry.routeId,
          segmentIndex: candidate.index - 1,
        },
        point: { ...candidate.point },
        t: 1,
        distanceSquared,
      };
    })
    .filter((candidate) => candidate.distanceSquared <= toleranceSquared)
    .sort(
      (left, right) =>
        left.distanceSquared - right.distanceSquared ||
        left.address.segmentIndex - right.address.segmentIndex,
    )[0];
  if (vertex) return vertex;

  return (
    geometry.segments
      .filter(isAxisAligned)
      .flatMap((segment) => {
        const hit = projectPointToRouteSegment(pointer, segment);
        return hit && hit.distanceSquared <= toleranceSquared ? [hit] : [];
      })
      .sort(
        (left, right) =>
          left.distanceSquared - right.distanceSquared ||
          left.address.segmentIndex - right.address.segmentIndex,
      )[0] ?? null
  );
}

export function findRouteSegmentsAtPoint(
  geometry: ResolvedDocumentRoutingGeometry,
  point: Point,
): RouteSegmentAddress[] {
  return [...geometry.routes.values()]
    .flatMap((route) =>
      route.segments
        .filter((segment) => {
          if (!isAxisAligned(segment)) return false;
          if (segment.from.x === segment.to.x) {
            return (
              point.x === segment.from.x &&
              point.y >= Math.min(segment.from.y, segment.to.y) &&
              point.y <= Math.max(segment.from.y, segment.to.y)
            );
          }
          return (
            point.y === segment.from.y &&
            point.x >= Math.min(segment.from.x, segment.to.x) &&
            point.x <= Math.max(segment.from.x, segment.to.x)
          );
        })
        .map((segment) => segment.address),
    )
    .sort(
      (left, right) =>
        left.routeId.localeCompare(right.routeId, "en") ||
        left.segmentIndex - right.segmentIndex,
    );
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
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
  routingGeometry: ResolvedDocumentRoutingGeometry = resolveDocumentRoutingGeometry(
    document,
    resolver,
  ),
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
      const leftGeometry = routingGeometry.routes.get(left.id);
      const rightGeometry = routingGeometry.routes.get(right.id);
      if (!leftGeometry || !rightGeometry) continue;
      const shared = sharedExplicitEndpoint(left, right);
      const sharedPoint = shared
        ? resolveEndpointPoint(document, resolver, shared)
        : null;
      for (const leftSegment of leftGeometry.segments) {
        for (const rightSegment of rightGeometry.segments) {
          const intersection = segmentIntersection(
            leftSegment.from,
            leftSegment.to,
            rightSegment.from,
            rightSegment.to,
          );
          if (!intersection) continue;
          if (sharedPoint && samePoint(sharedPoint, intersection.point)) {
            continue;
          }
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
