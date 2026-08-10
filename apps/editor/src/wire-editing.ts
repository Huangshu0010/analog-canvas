import type { SchematicEdit } from "@icm/edit-engine";
import type { Point, RouteEndpoint, SchematicDocument } from "@icm/model";

import { buildManualWirePath } from "./wire-path";

export interface WireSource {
  endpoint: RouteEndpoint;
  netId: string | null;
  point: Point;
  preludeEdits: SchematicEdit[];
}

export interface WireCommitProposal {
  routeId: string;
  netId: string;
  edits: SchematicEdit[];
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
