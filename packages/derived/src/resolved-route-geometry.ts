import type { Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveEndpointOutwardDirection } from "./endpoint.js";
import { routePolyline, type SegmentMode } from "./routes.js";

/**
 * Unified resolved geometry for one Route (ADR 0014). Single geometry truth for
 * rendering, hit testing, segment drag, marker attachment, diagnostics, and
 * formal export. Never persisted.
 *
 * `centerline` keeps the accepted `[from, …waypoints, to]` shape and strictly
 * terminates at real Pin/Port/Junction origins. `endpointJoins` carry the raw
 * geometric ingredients of the renderer's private terminal miter bridge (the
 * renderer applies its own profile-scaled overlap to produce the final stroke).
 * Cross-route route-anchor joins are produced separately by
 * `resolveRouteAnchorJoins`, since they aggregate two route ends at a shared
 * degree-2 anchor. Production consumers keep using `routePolyline` and the
 * renderer's private bridges until the R10 migration.
 */

export interface ResolvedRouteSegment {
  /** Positional compatibility index within this resolved route revision. */
  index: number;
  /**
   * Address valid only while the owning Document stays at `documentRevision`.
   * Stored-route mutations must return an explicit remap; array position alone
   * is never a cross-edit attachment identity.
   */
  ref: RouteSegmentRef;
  from: Point;
  to: Point;
  mode: SegmentMode;
}

export type ResolvedRouteVertexKind =
  "terminal" | "junction" | "bend" | "route-anchor";

export interface ResolvedRouteVertex {
  index: number;
  ref: RouteVertexRef;
  point: Point;
  kind: ResolvedRouteVertexKind;
}

export type EndpointJoin =
  | {
      kind: "terminal-miter";
      routeId: string;
      /** Real Pin origin. */
      at: Point;
      /** Outward pin direction (terminal only). */
      pinOutward: Point;
      /** Sign of the adjacent route segment leaving the terminal. */
      routeDirection: Point;
    }
  | {
      kind: "route-anchor-miter";
      junctionId: string;
      /** Real Junction origin. */
      at: Point;
      /** The two route-end directions meeting at the degree-2 anchor. */
      directions: readonly [Point, Point];
    };

export interface HitSegment {
  segmentIndex: number;
  segmentRef: RouteSegmentRef;
  from: Point;
  to: Point;
  /** Consumer applies screen tolerance; this never moves the centerline. */
  horizontal: boolean;
}

export interface ResolvedRouteGeometry {
  routeId: string;
  netId: string;
  centerline: readonly Point[];
  segments: readonly ResolvedRouteSegment[];
  vertices: readonly ResolvedRouteVertex[];
  endpointJoins: readonly EndpointJoin[];
  hitGeometry: readonly HitSegment[];
  bounds: { min: Point; max: Point };
}

export interface RouteSegmentRef {
  documentId: string;
  documentRevision: number;
  routeId: string;
  index: number;
}

export interface RouteVertexRef {
  documentId: string;
  documentRevision: number;
  routeId: string;
  index: number;
}

/**
 * A mutation-owned mapping from a route segment before an edit to the segment
 * that carries its attachment afterwards. Pure geometry resolution never
 * invents this mapping; C5 planners must emit it alongside split/normalise/
 * stretch operations.
 */
export interface RouteAttachmentRemap {
  from: RouteSegmentRef;
  to: RouteSegmentRef | null;
}

/** Complete pure routing read model for one Document. */
export interface ResolvedDocumentRoutingGeometry {
  documentId: string;
  documentRevision: number;
  routes: ReadonlyMap<string, ResolvedRouteGeometry>;
  /** Terminal and cross-route anchor joins in deterministic order. */
  endpointJoins: readonly EndpointJoin[];
}

/** Sign direction of an axis-aligned segment, or null if diagonal/zero. */
function axisDirection(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy === 0) return { x: Math.sign(dx), y: 0 };
  if (dx === 0 && dy !== 0) return { x: 0, y: Math.sign(dy) };
  return null;
}

function vertexKindForEndpoint(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
): ResolvedRouteVertexKind {
  if (endpoint.kind === "terminal") return "terminal";
  const junction = document.junctions.find(
    (candidate) => candidate.id === endpoint.junctionId,
  );
  return junction?.role === "route-anchor" ? "route-anchor" : "junction";
}

export function resolveRouteGeometry(
  document: SchematicDocument,
  resolver: SymbolResolver,
  route: SchematicDocument["routes"][number],
): ResolvedRouteGeometry | null {
  const polyline = routePolyline(document, resolver, route);
  if (!polyline) return null;
  const points = polyline.points;

  const segments: ResolvedRouteSegment[] = [];
  const hitGeometry: HitSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const horizontal = from.y === to.y;
    segments.push({
      index,
      ref: {
        documentId: document.id,
        documentRevision: document.revision,
        routeId: route.id,
        index,
      },
      from,
      to,
      mode: polyline.segmentModes[index] ?? "auto",
    });
    hitGeometry.push({
      segmentIndex: index,
      segmentRef: {
        documentId: document.id,
        documentRevision: document.revision,
        routeId: route.id,
        index,
      },
      from,
      to,
      horizontal,
    });
  }

  const vertices: ResolvedRouteVertex[] = points.map((point, index) => {
    let kind: ResolvedRouteVertexKind;
    if (index === 0) kind = vertexKindForEndpoint(document, route.from);
    else if (index === points.length - 1)
      kind = vertexKindForEndpoint(document, route.to);
    else kind = "bend";
    return {
      index,
      ref: {
        documentId: document.id,
        documentRevision: document.revision,
        routeId: route.id,
        index,
      },
      point,
      kind,
    };
  });

  const endpointJoins: EndpointJoin[] = [];
  if (route.from.kind === "terminal" && points.length >= 2) {
    const pinOutward = resolveEndpointOutwardDirection(
      document,
      resolver,
      route.from,
    );
    const routeDirection = axisDirection(points[0]!, points[1]!);
    if (pinOutward && routeDirection) {
      endpointJoins.push({
        kind: "terminal-miter",
        routeId: route.id,
        at: points[0]!,
        pinOutward,
        routeDirection,
      });
    }
  }
  if (route.to.kind === "terminal" && points.length >= 2) {
    const pinOutward = resolveEndpointOutwardDirection(
      document,
      resolver,
      route.to,
    );
    const routeDirection = axisDirection(points.at(-1)!, points.at(-2)!);
    if (pinOutward && routeDirection) {
      endpointJoins.push({
        kind: "terminal-miter",
        routeId: route.id,
        at: points.at(-1)!,
        pinOutward,
        routeDirection,
      });
    }
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bounds = {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) },
  };

  return {
    routeId: polyline.routeId,
    netId: polyline.netId,
    centerline: points,
    segments,
    vertices,
    endpointJoins,
    hitGeometry,
    bounds,
  };
}

/**
 * Resolve all routable geometry in one Document. This is the only geometry
 * result that includes cross-route joins, avoiding a second consumer-specific
 * traversal for route-anchor bridges.
 */
export function resolveDocumentRoutingGeometry(
  document: SchematicDocument,
  resolver: SymbolResolver,
): ResolvedDocumentRoutingGeometry {
  const routes = new Map<string, ResolvedRouteGeometry>();
  const terminalJoins: EndpointJoin[] = [];
  for (const route of [...document.routes].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  )) {
    const geometry = resolveRouteGeometry(document, resolver, route);
    if (!geometry) continue;
    routes.set(route.id, geometry);
    terminalJoins.push(...geometry.endpointJoins);
  }
  return {
    documentId: document.id,
    documentRevision: document.revision,
    routes,
    endpointJoins: [
      ...terminalJoins,
      ...resolveRouteAnchorJoins(document, resolver),
    ],
  };
}

/**
 * Cross-route route-anchor miter joins for one Document (ADR 0014). A
 * `route-anchor` Junction shared by exactly two axis-aligned route ends renders
 * dotless as one sharp path; degree-1 (free end) and degree-≥3 (real branch)
 * anchors are excluded, mirroring the renderer's
 * `renderRouteAnchorMiterBridges` filter. Each join carries the two route-end
 * direction vectors; the renderer applies its profile-scaled overlap.
 */
export function resolveRouteAnchorJoins(
  document: SchematicDocument,
  resolver: SymbolResolver,
): EndpointJoin[] {
  const anchors = new Map<string, { point: Point; directions: Point[] }>();
  for (const junction of document.junctions) {
    if (junction.role === "route-anchor") {
      anchors.set(junction.id, { point: junction.position, directions: [] });
    }
  }
  const record = (
    endpoint: SchematicDocument["routes"][number]["from"],
    point: Point,
    neighbor: Point,
  ) => {
    if (endpoint.kind !== "junction") return;
    const anchor = anchors.get(endpoint.junctionId);
    if (!anchor) return;
    const direction = axisDirection(point, neighbor);
    if (direction) anchor.directions.push(direction);
  };
  for (const route of document.routes) {
    const polyline = routePolyline(document, resolver, route);
    if (!polyline || polyline.points.length < 2) continue;
    record(route.from, polyline.points[0]!, polyline.points[1]!);
    record(route.to, polyline.points.at(-1)!, polyline.points.at(-2)!);
  }
  return [...anchors.entries()]
    .filter(([, anchor]) => anchor.directions.length === 2)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([junctionId, anchor]): EndpointJoin => ({
      kind: "route-anchor-miter",
      junctionId,
      at: anchor.point,
      directions: [anchor.directions[0]!, anchor.directions[1]!] as readonly [
        Point,
        Point,
      ],
    }));
}
