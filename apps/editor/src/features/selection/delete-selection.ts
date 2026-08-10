import { endpointKey, resolveEndpointPoint } from "@icm/derived";
import type { SchematicEdit } from "@icm/edit-engine";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

/**
 * Normalizes visual route deletion before edits are assembled. A selected
 * junction owns every route ending at it; a junction that becomes unused after
 * selected routes disappear is cleaned up in the same transaction. The fixed
 * point handles chains such as `junction → route → junction` without emitting
 * duplicate route or junction edits.
 */
export function collectVisualRouteDeletion(
  document: SchematicDocument,
  routeIds: readonly string[],
  junctionIds: readonly string[],
): { routeIds: string[]; junctionIds: string[] } {
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

  return {
    routeIds: [...routesToRemove],
    junctionIds: [...junctionsToRemove],
  };
}

export function proposeConnectedInstanceDeletion(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instanceIds: readonly string[],
  sequence: number,
): SchematicEdit[] {
  const selected = new Set(instanceIds);
  const replacements = new Map<string, RouteEndpoint>();
  const junctionEdits: SchematicEdit[] = [];
  const disconnectEdits: SchematicEdit[] = [];
  const occupiedIds = new Set(
    [
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
    ].map((object) => object.id),
  );
  let junctionCounter = 0;

  for (const net of document.nets) {
    for (const terminal of net.terminals) {
      if (!selected.has(terminal.instanceId)) continue;
      const endpoint: RouteEndpoint = { kind: "terminal", ...terminal };
      const key = endpointKey(endpoint);
      const usedByRoute = document.routes.some(
        (route) =>
          endpointKey(route.from) === key || endpointKey(route.to) === key,
      );
      if (usedByRoute) {
        const position = resolveEndpointPoint(document, resolver, endpoint);
        if (!position) {
          throw new Error(`Cannot preserve unresolved endpoint ${key}`);
        }
        let junctionId: string;
        do {
          junctionCounter += 1;
          junctionId = `junction-delete-${sequence}-${junctionCounter}`;
        } while (occupiedIds.has(junctionId));
        occupiedIds.add(junctionId);
        const replacement: RouteEndpoint = { kind: "junction", junctionId };
        replacements.set(key, replacement);
        junctionEdits.push({
          kind: "add_junction",
          junctionId,
          netId: net.id,
          position,
        });
      }
      disconnectEdits.push({ kind: "disconnect_endpoint", endpoint });
    }
  }

  const routeEdits = document.routes.flatMap((route): SchematicEdit[] => {
    const from = replacements.get(endpointKey(route.from)) ?? route.from;
    const to = replacements.get(endpointKey(route.to)) ?? route.to;
    if (from === route.from && to === route.to) return [];
    return [
      {
        kind: "set_route_points",
        routeId: route.id,
        netId: route.netId,
        from,
        to,
        waypoints: route.waypoints.map((point) => ({ ...point })),
        segmentModes: [...route.segmentModes],
      },
    ];
  });
  const annotationEdits = document.annotations
    .filter(
      (annotation) =>
        annotation.attachedObjectId !== undefined &&
        selected.has(annotation.attachedObjectId),
    )
    .map((annotation): SchematicEdit => ({
      kind: "remove_annotation",
      annotationId: annotation.id,
    }));
  const instanceEdits = document.instances
    .filter((instance) => selected.has(instance.id))
    .map((instance): SchematicEdit => ({
      kind: "remove_instance",
      instanceId: instance.id,
    }));
  return [
    ...junctionEdits,
    ...routeEdits,
    ...disconnectEdits,
    ...annotationEdits,
    ...instanceEdits,
  ];
}

/**
 * `proposeConnectedInstanceDeletion()` removes annotations attached to a
 * selected instance. A marquee can independently select that same label, so
 * callers must not append a second remove_annotation edit for it.
 */
export function explicitAnnotationRemovals(
  document: SchematicDocument,
  instanceIds: readonly string[],
  annotationIds: readonly string[],
): string[] {
  const selectedInstances = new Set(instanceIds);
  const removedWithInstances = new Set(
    document.annotations
      .filter(
        (annotation) =>
          annotation.attachedObjectId !== undefined &&
          selectedInstances.has(annotation.attachedObjectId),
      )
      .map((annotation) => annotation.id),
  );
  return [...new Set(annotationIds)].filter(
    (id) => !removedWithInstances.has(id),
  );
}
