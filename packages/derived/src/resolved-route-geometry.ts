import type {
  Point,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "./endpoint.js";

/** A segment address is valid only for the current document revision. */
export interface RouteSegmentAddress {
  routeId: string;
  segmentIndex: number;
}

export interface ResolvedRouteSegment {
  address: RouteSegmentAddress;
  from: Point;
  to: Point;
  mode: RouteBranch["segmentModes"][number];
}

export type ResolvedRouteVertexKind =
  "terminal" | "junction" | "bend" | "route-anchor";

export interface ResolvedRouteVertex {
  index: number;
  point: Point;
  kind: ResolvedRouteVertexKind;
}

export type EndpointJoin =
  | {
      kind: "terminal-miter";
      routeId: string;
      at: Point;
      pinOutward: Point;
      routeDirection: Point;
    }
  | {
      kind: "route-anchor-miter";
      junctionId: string;
      at: Point;
      directions: readonly [Point, Point];
    };

export interface ResolvedRouteGeometry {
  routeId: string;
  netId: string;
  centerline: readonly Point[];
  segments: readonly ResolvedRouteSegment[];
  vertices: readonly ResolvedRouteVertex[];
  endpointJoins: readonly EndpointJoin[];
}

/** Complete pure routing read model for one Document. */
export interface ResolvedDocumentRoutingGeometry {
  documentId: string;
  documentRevision: number;
  routes: ReadonlyMap<string, ResolvedRouteGeometry>;
  endpointJoins: readonly EndpointJoin[];
}

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
  const from = resolveEndpointPoint(document, resolver, route.from);
  const to = resolveEndpointPoint(document, resolver, route.to);
  if (!from || !to) return null;
  const centerline = [from, ...route.waypoints, to];
  const segments: ResolvedRouteSegment[] = centerline
    .slice(0, -1)
    .map((segmentFrom, segmentIndex) => ({
      address: { routeId: route.id, segmentIndex },
      from: segmentFrom,
      to: centerline[segmentIndex + 1]!,
      mode: route.segmentModes[segmentIndex] ?? "auto",
    }));
  const vertices: ResolvedRouteVertex[] = centerline.map((point, index) => ({
    index,
    point,
    kind:
      index === 0
        ? vertexKindForEndpoint(document, route.from)
        : index === centerline.length - 1
          ? vertexKindForEndpoint(document, route.to)
          : "bend",
  }));

  const endpointJoins: EndpointJoin[] = [];
  if (route.from.kind === "terminal" && centerline.length >= 2) {
    const pinOutward = resolveEndpointOutwardDirection(
      document,
      resolver,
      route.from,
    );
    const routeDirection = axisDirection(centerline[0]!, centerline[1]!);
    if (pinOutward && routeDirection) {
      endpointJoins.push({
        kind: "terminal-miter",
        routeId: route.id,
        at: centerline[0]!,
        pinOutward,
        routeDirection,
      });
    }
  }
  if (route.to.kind === "terminal" && centerline.length >= 2) {
    const pinOutward = resolveEndpointOutwardDirection(
      document,
      resolver,
      route.to,
    );
    const routeDirection = axisDirection(
      centerline.at(-1)!,
      centerline.at(-2)!,
    );
    if (pinOutward && routeDirection) {
      endpointJoins.push({
        kind: "terminal-miter",
        routeId: route.id,
        at: centerline.at(-1)!,
        pinOutward,
        routeDirection,
      });
    }
  }

  return {
    routeId: route.id,
    netId: route.netId,
    centerline,
    segments,
    vertices,
    endpointJoins,
  };
}

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
      ...resolveRouteAnchorJoinsFromGeometry(document, routes),
    ],
  };
}

export function resolveRouteAnchorJoins(
  document: SchematicDocument,
  resolver: SymbolResolver,
): EndpointJoin[] {
  const routes = new Map<string, ResolvedRouteGeometry>();
  for (const route of document.routes) {
    const geometry = resolveRouteGeometry(document, resolver, route);
    if (geometry) routes.set(route.id, geometry);
  }
  return resolveRouteAnchorJoinsFromGeometry(document, routes);
}

function resolveRouteAnchorJoinsFromGeometry(
  document: SchematicDocument,
  routes: ReadonlyMap<string, ResolvedRouteGeometry>,
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
    const centerline = routes.get(route.id)?.centerline;
    if (!centerline || centerline.length < 2) continue;
    record(route.from, centerline[0]!, centerline[1]!);
    record(route.to, centerline.at(-1)!, centerline.at(-2)!);
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
