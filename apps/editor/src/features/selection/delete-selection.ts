import { endpointKey, resolveEndpointPoint } from "@icm/derived";
import {
  proposeVisualRouteDeletion,
  type SchematicEdit,
} from "@icm/edit-engine";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

export interface VisualDeletionSelection {
  readonly instanceIds: readonly string[];
  readonly routeIds: readonly string[];
  readonly junctionIds: readonly string[];
  readonly annotationIds: readonly string[];
  readonly draftingIds: readonly string[];
}

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
  const proposal = proposeSelectionRouteDeletion(
    document,
    routeIds,
    junctionIds,
  );
  return { routeIds: proposal.routeIds, junctionIds: proposal.junctionIds };
}

/**
 * Route geometry is the authoritative deletion target whenever the visual
 * selection contains a Route. A marquee commonly includes the shared
 * Junction dot at a selected branch endpoint; treating that incidental dot as
 * an independent Junction deletion would expand into every sibling Route.
 * Junction-only deletion retains the explicit topology-vertex behavior.
 */
export function proposeSelectionRouteDeletion(
  document: SchematicDocument,
  routeIds: readonly string[],
  junctionIds: readonly string[],
) {
  return proposeVisualRouteDeletion(
    document,
    routeIds,
    routeIds.length > 0 ? [] : junctionIds,
  );
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
        ...(route.presentation ? { presentation: route.presentation } : {}),
      },
    ];
  });
  const annotationEdits = document.annotations
    .filter(
      (annotation) =>
        annotation.anchor.kind === "object" &&
        selected.has(annotation.anchor.objectId),
    )
    .map((annotation): SchematicEdit => ({
      kind: "remove_schematic_annotation",
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
 * One shared delete proposal for an arbitrary visual selection. Structural
 * workflows (such as formal Cell Port removal) use this instead of falling
 * back to a separate Document transaction and changing deletion semantics.
 */
export function proposeVisualSelectionDeletion(
  document: SchematicDocument,
  resolver: SymbolResolver,
  selection: VisualDeletionSelection,
  sequence: number,
): SchematicEdit[] {
  const visualRouteDeletion = proposeVisualRouteDeletion(
    document,
    selection.routeIds,
    selection.routeIds.length > 0 ? [] : selection.junctionIds,
  );
  const instanceEdits =
    selection.instanceIds.length > 0
      ? proposeConnectedInstanceDeletion(
          document,
          resolver,
          selection.instanceIds,
          sequence,
        )
      : [];
  const annotationIds = explicitAnnotationRemovals(
    document,
    selection.instanceIds,
    selection.annotationIds.filter(
      (annotationId) =>
        !visualRouteDeletion.annotationIds.includes(annotationId),
    ),
  );
  return [
    ...instanceEdits,
    ...visualRouteDeletion.edits,
    ...annotationIds.map((annotationId): SchematicEdit => ({
      kind: "remove_schematic_annotation",
      annotationId,
    })),
    ...selection.draftingIds.map((objectId): SchematicEdit => ({
      kind: "remove_drafting_object",
      objectId,
    })),
  ];
}

/**
 * `proposeConnectedInstanceDeletion()` removes annotations attached to a
 * selected instance. A marquee can independently select that same label, so
 * callers must not append a second remove_schematic_annotation edit for it.
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
          annotation.anchor.kind === "object" &&
          selectedInstances.has(annotation.anchor.objectId),
      )
      .map((annotation) => annotation.id),
  );
  return [...new Set(annotationIds)].filter(
    (id) => !removedWithInstances.has(id),
  );
}
