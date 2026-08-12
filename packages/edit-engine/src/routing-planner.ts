import { normalizeRouteGeometry, type SegmentMode } from "@icm/derived";
import type { Point, RouteEndpoint, SchematicDocument } from "@icm/model";

import type { SchematicEdit } from "./transaction.js";

export interface WireEndpointGeometry {
  point: Point;
}

export interface ManualWirePath {
  points: Point[];
  waypoints: Point[];
  segmentModes: SegmentMode[];
}

export interface WireSource extends WireEndpointGeometry {
  endpoint: RouteEndpoint;
  netId: string | null;
  preludeEdits: SchematicEdit[];
}

export interface WireCommitProposal {
  routeId: string;
  netId: string;
  edits: SchematicEdit[];
}

export interface VisualRouteDeletion {
  routeIds: string[];
  junctionIds: string[];
  edits: SchematicEdit[];
}

/**
 * Collect the closure for deleting visual route geometry. It deliberately uses
 * `cut_connection`, which removes only stored Wire/Junction facts; it does not
 * remove Net membership or implicitly sever the electrical net.
 */
export function proposeVisualRouteDeletion(
  document: SchematicDocument,
  routeIds: readonly string[],
  junctionIds: readonly string[],
): VisualRouteDeletion {
  const routesToRemove = new Set(routeIds);
  const junctionsToRemove = new Set(junctionIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const route of document.routes) {
      const touchesDeletedJunction =
        (route.from.kind === "junction" &&
          junctionsToRemove.has(route.from.junctionId)) ||
        (route.to.kind === "junction" &&
          junctionsToRemove.has(route.to.junctionId));
      if (touchesDeletedJunction && !routesToRemove.has(route.id)) {
        routesToRemove.add(route.id);
        changed = true;
      }
    }
    for (const junction of document.junctions) {
      if (junctionsToRemove.has(junction.id)) continue;
      const attachedRoutes = document.routes.filter(
        (route) =>
          (route.from.kind === "junction" &&
            route.from.junctionId === junction.id) ||
          (route.to.kind === "junction" && route.to.junctionId === junction.id),
      );
      if (
        attachedRoutes.length > 0 &&
        attachedRoutes.every((route) => routesToRemove.has(route.id))
      ) {
        junctionsToRemove.add(junction.id);
        changed = true;
      }
    }
  }
  const sortedRouteIds = [...routesToRemove].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const sortedJunctionIds = [...junctionsToRemove].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  // `cut_connection` removes a junction that becomes orphaned. Only a selected
  // junction already detached before this transaction needs an explicit edit;
  // otherwise a second remove would reject the transaction.
  const alreadyOrphanedJunctionIds = sortedJunctionIds.filter(
    (junctionId) =>
      !document.routes.some(
        (route) =>
          (route.from.kind === "junction" &&
            route.from.junctionId === junctionId) ||
          (route.to.kind === "junction" && route.to.junctionId === junctionId),
      ),
  );
  return {
    routeIds: sortedRouteIds,
    junctionIds: sortedJunctionIds,
    edits: [
      ...sortedRouteIds.map((routeId): SchematicEdit => ({
        kind: "cut_connection",
        routeId,
      })),
      ...alreadyOrphanedJunctionIds.map((junctionId): SchematicEdit => ({
        kind: "remove_junction",
        junctionId,
      })),
    ],
  };
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
    append(
      points,
      modes,
      previous
        ? previous.y === last.y
          ? { x: target.x, y: last.y }
          : { x: last.x, y: target.y }
        : { x: target.x, y: last.y },
      mode,
    );
  }
  append(points, modes, target, mode);
}

/** Build a persisted manual orthogonal path without hidden terminal escapes. */
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
  if (points.length === 1) return { points, waypoints: [], segmentModes: [] };
  const normalized = normalizeRouteGeometry(points, modes);
  return {
    points: normalized.points,
    waypoints: normalized.points.slice(1, -1),
    segmentModes: normalized.segmentModes,
  };
}

export function proposeWireCommit(
  from: WireSource,
  to: WireSource,
  manualWaypoints: readonly Point[],
  suffix: number,
): WireCommitProposal {
  const edits: SchematicEdit[] = [...from.preludeEdits, ...to.preludeEdits];
  let netId = from.netId ?? to.netId;
  if (from.netId && to.netId && from.netId !== to.netId) {
    netId = from.netId;
    edits.push({
      kind: "merge_nets",
      targetNetId: from.netId,
      sourceNetId: to.netId,
    });
  }
  if (!netId) netId = `net-ui-${suffix}`;
  edits.push({
    kind: "connect_endpoints",
    from: from.endpoint,
    to: to.endpoint,
    ...(!from.netId && !to.netId ? { newNetId: netId } : {}),
  });
  const routeId = `route-ui-${suffix}`;
  const routed = buildManualWirePath(from, to, manualWaypoints);
  edits.push({
    kind: "set_route_points",
    routeId,
    netId,
    from: from.endpoint,
    to: to.endpoint,
    waypoints: routed.waypoints,
    segmentModes: routed.segmentModes,
  });
  return { routeId, netId, edits };
}

export function createFreeWireAnchor(
  point: Point,
  netId: string,
  createNet: boolean,
  suffix: number,
): WireSource {
  const junctionId = `junction-ui-${suffix}`;
  return {
    endpoint: { kind: "junction", junctionId },
    netId,
    point,
    preludeEdits: [
      {
        kind: "add_junction",
        junctionId,
        netId,
        position: point,
        role: "route-anchor",
        ...(createNet ? { createNet: true } : {}),
      },
    ],
  };
}

export function createRouteWireAnchor(
  route: SchematicDocument["routes"][number],
  point: Point,
  segmentIndex: number,
  grid: number,
  suffix: number,
): WireSource {
  const junctionId = `junction-ui-${suffix}`;
  const splitPoint = {
    x: Math.round(point.x / grid) * grid,
    y: Math.round(point.y / grid) * grid,
  };
  return {
    endpoint: { kind: "junction", junctionId },
    netId: route.netId,
    point: splitPoint,
    preludeEdits: [
      {
        kind: "add_junction",
        junctionId,
        netId: route.netId,
        position: splitPoint,
        split: {
          routeId: route.id,
          firstRouteId: `${route.id}-a-${suffix}`,
          secondRouteId: `${route.id}-b-${suffix}`,
          segmentIndex,
        },
      },
    ],
  };
}
