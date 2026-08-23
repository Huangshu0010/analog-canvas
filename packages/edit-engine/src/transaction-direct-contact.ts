import { deriveStableId } from "@icm/model";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";
import {
  deriveDirectContactDelta,
  endpointKey,
  isMosBulkTerminal,
  resolveEndpointPoint,
} from "@icm/derived";
import type { SymbolResolver } from "@icm/symbols";

import { buildManualWirePath } from "./routing-planner.js";
import {
  endpointOwnerNetId,
  netEndpointGroups,
} from "./transaction-routing.js";

export interface DirectContactReconciliation {
  geometryChanged: boolean;
  changedRouteIds: readonly string[];
}

function endpointsSharePhysicalComponent(
  document: SchematicDocument,
  resolver: SymbolResolver,
  netId: string,
  endpoints: readonly [RouteEndpoint, RouteEndpoint],
): boolean {
  const [leftKey, rightKey] = endpoints.map(endpointKey);
  return netEndpointGroups(document, netId, resolver).some(
    (group) => group.includes(leftKey!) && group.includes(rightKey!),
  );
}

function uniqueDerivedId(
  document: SchematicDocument,
  transactionId: string,
  pairId: string,
): string {
  const occupied = new Set([
    ...document.instances.map((instance) => instance.id),
    ...document.nets.map((net) => net.id),
    ...document.routes.map((route) => route.id),
    ...document.junctions.map((junction) => junction.id),
    ...document.annotations.map((annotation) => annotation.id),
    ...document.noConnects.map((noConnect) => noConnect.id),
    ...document.connectivityEvidence.map((evidence) => evidence.id),
    ...document.layoutGroups.map((group) => group.id),
    ...document.constraints.map((constraint) => constraint.id),
    ...(document.drafting?.objects.map((object) => object.id) ?? []),
    ...(document.netlist?.terminals.map((terminal) => terminal.id) ?? []),
  ]);
  let attempt = 0;
  while (true) {
    const id = deriveStableId(
      "route",
      document.id,
      "direct-contact",
      transactionId,
      pairId,
      String(attempt),
    );
    if (!occupied.has(id)) return id;
    attempt += 1;
  }
}

/**
 * Reconcile zero-length endpoint contacts once, after all transform edits have
 * reached their final projected positions.
 *
 * This mutates only ordinary Route geometry. It never creates or merges Base
 * Nets: new direct-contact intent remains an explicit authoring action.
 */
export function reconcileTransformDirectContacts(
  before: SchematicDocument,
  draft: SchematicDocument,
  resolver: SymbolResolver,
  transactionId: string,
  changedObjectIds: Set<string>,
): DirectContactReconciliation {
  const delta = deriveDirectContactDelta(before, draft, resolver);
  let geometryChanged = false;
  const changedRouteIds: string[] = [];

  for (const pair of delta.lost) {
    const [left, right] = pair.endpoints;
    const leftOwner = endpointOwnerNetId(draft, left);
    const rightOwner = endpointOwnerNetId(draft, right);
    if (!leftOwner || leftOwner !== rightOwner) continue;
    if (
      endpointsSharePhysicalComponent(
        draft,
        resolver,
        leftOwner,
        pair.endpoints,
      )
    ) {
      continue;
    }
    const leftPoint = resolveEndpointPoint(draft, resolver, left);
    const rightPoint = resolveEndpointPoint(draft, resolver, right);
    if (
      !leftPoint ||
      !rightPoint ||
      (leftPoint.x === rightPoint.x && leftPoint.y === rightPoint.y)
    ) {
      continue;
    }
    const geometry = buildManualWirePath(
      { point: leftPoint },
      { point: rightPoint },
    );
    const routeId = uniqueDerivedId(draft, transactionId, pair.id);
    draft.routes.push({
      id: routeId,
      netId: leftOwner,
      from: structuredClone(left),
      to: structuredClone(right),
      waypoints: geometry.waypoints,
      segmentModes: geometry.segmentModes,
      ...([left, right].some((endpoint) => isMosBulkTerminal(draft, endpoint))
        ? { presentation: "bulk-dashed" as const }
        : {}),
    });
    changedObjectIds.add(routeId);
    changedRouteIds.push(routeId);
    geometryChanged = true;
  }

  return {
    geometryChanged,
    changedRouteIds,
  };
}
