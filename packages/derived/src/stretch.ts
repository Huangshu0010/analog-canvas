import type { Point, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveEndpointPoint } from "./endpoint.js";
import {
  isOrthogonal,
  normalizeRouteGeometry,
  routePolyline,
} from "./routes.js";
import type { SegmentMode } from "./routes.js";

export interface RouteStretchProposal {
  routeId: string;
  waypoints: Point[];
  segmentModes: SegmentMode[];
}

export interface InstanceMoveProposal {
  instanceId: string;
  position: Point;
}

export function proposeLocalStretch(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instanceId: string,
  newPosition: Point,
): RouteStretchProposal[] {
  const instance = document.instances.find(
    (candidate) => candidate.id === instanceId,
  );
  if (!instance?.placement)
    throw new Error(`Placed instance not found: ${instanceId}`);
  const movedDocument = structuredClone(document);
  const movedInstance = movedDocument.instances.find(
    (candidate) => candidate.id === instanceId,
  )!;
  movedInstance.placement!.position = { ...newPosition };
  const proposals: RouteStretchProposal[] = [];

  for (const route of document.routes) {
    const movesFrom =
      route.from.kind === "terminal" && route.from.instanceId === instanceId;
    const movesTo =
      route.to.kind === "terminal" && route.to.instanceId === instanceId;
    if (!movesFrom && !movesTo) continue;
    const original = routePolyline(document, resolver, route);
    const newFrom = resolveEndpointPoint(movedDocument, resolver, route.from);
    const newTo = resolveEndpointPoint(movedDocument, resolver, route.to);
    if (!original || !newFrom || !newTo) continue;
    const adjacentMode = movesFrom
      ? route.segmentModes[0]
      : route.segmentModes.at(-1);
    if (adjacentMode === "locked" || adjacentMode === "trunk") {
      throw new Error(`Route ${route.id} has a protected adjacent segment`);
    }
    const waypoints = route.waypoints.map((point) => ({ ...point }));
    let modes = [...route.segmentModes];
    if (waypoints.length === 0) {
      if (newFrom.x !== newTo.x && newFrom.y !== newTo.y) {
        waypoints.push({ x: newTo.x, y: newFrom.y });
        const mode = route.segmentModes[0] ?? "escape";
        modes = [mode, mode];
      }
    } else if (movesFrom) {
      const oldFrom = original.points[0]!;
      const first = waypoints[0]!;
      if (oldFrom.x === first.x) first.x = newFrom.x;
      else first.y = newFrom.y;
    } else if (movesTo) {
      const oldTo = original.points.at(-1)!;
      const last = waypoints.at(-1)!;
      if (oldTo.x === last.x) last.x = newTo.x;
      else last.y = newTo.y;
    }
    const normalized = normalizeRouteGeometry(
      [newFrom, ...waypoints, newTo],
      modes,
    );
    if (!isOrthogonal(normalized.points)) {
      throw new Error(
        `Local stretch would make route ${route.id} non-orthogonal`,
      );
    }
    proposals.push({
      routeId: route.id,
      waypoints: normalized.points.slice(1, -1),
      segmentModes: normalized.segmentModes,
    });
  }
  return proposals.sort((left, right) =>
    left.routeId.localeCompare(right.routeId, "en"),
  );
}

export function proposeGroupStretch(
  document: SchematicDocument,
  resolver: SymbolResolver,
  moves: readonly InstanceMoveProposal[],
): RouteStretchProposal[] {
  const moveByInstance = new Map(
    moves.map((move) => [move.instanceId, move.position]),
  );
  const deltaByInstance = new Map<string, Point>();
  for (const move of moves) {
    const instance = document.instances.find(
      (candidate) => candidate.id === move.instanceId,
    );
    if (!instance?.placement) {
      throw new Error(`Placed instance not found: ${move.instanceId}`);
    }
    deltaByInstance.set(move.instanceId, {
      x: move.position.x - instance.placement.position.x,
      y: move.position.y - instance.placement.position.y,
    });
  }

  const proposals = new Map<string, RouteStretchProposal>();
  for (const route of document.routes) {
    const fromDelta =
      route.from.kind === "terminal"
        ? deltaByInstance.get(route.from.instanceId)
        : undefined;
    const toDelta =
      route.to.kind === "terminal"
        ? deltaByInstance.get(route.to.instanceId)
        : undefined;
    if (!fromDelta && !toDelta) continue;

    if (
      fromDelta &&
      toDelta &&
      fromDelta.x === toDelta.x &&
      fromDelta.y === toDelta.y
    ) {
      if (route.segmentModes.includes("locked")) {
        throw new Error(`Route ${route.id} contains a locked segment`);
      }
      proposals.set(route.id, {
        routeId: route.id,
        waypoints: route.waypoints.map((point) => ({
          x: point.x + fromDelta.x,
          y: point.y + fromDelta.y,
        })),
        segmentModes: [...route.segmentModes],
      });
      continue;
    }

    if (fromDelta && toDelta) {
      throw new Error(
        `Route ${route.id} cannot stretch endpoints by different group deltas`,
      );
    }
    const instanceId =
      route.from.kind === "terminal" &&
      moveByInstance.has(route.from.instanceId)
        ? route.from.instanceId
        : route.to.kind === "terminal"
          ? route.to.instanceId
          : null;
    if (!instanceId) continue;
    const position = moveByInstance.get(instanceId)!;
    const local = proposeLocalStretch(document, resolver, instanceId, position);
    const proposal = local.find((candidate) => candidate.routeId === route.id);
    if (proposal) proposals.set(route.id, proposal);
  }
  return [...proposals.values()].sort((left, right) =>
    left.routeId.localeCompare(right.routeId, "en"),
  );
}
