import { endpointKey, resolveEndpointPoint } from "@icm/derived";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { SchematicEdit } from "./edit-schema.js";

/**
 * Plans the presentation-only transition from canvas to Placement Tray.
 * Electrical terminal membership, NoConnect declarations, and annotations
 * remain owned by the retained Instance. Routed pins are represented by
 * Junctions before the placement disappears, so every visible wire endpoint
 * remains resolvable.
 */
export function planInstanceUnplacement(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instanceIds: readonly string[],
  sequence: number,
): SchematicEdit[] {
  const selected = selectedExistingInstanceIds(document, instanceIds);
  if (selected.size === 0) return [];
  return [
    ...planRoutedTerminalDetachment(document, resolver, selected, sequence),
    ...instancesById(document, selected).map((instance): SchematicEdit => ({
      kind: "unplace_instance",
      instanceId: instance.id,
    })),
  ];
}

/**
 * Plans complete Instance disposal. This deliberately composes ordinary
 * strict edits instead of adding a second destructive edit kind: routes are
 * detached first, electrical memberships and explicit opens are removed, then
 * annotations/layout references and the Instance itself are removed.
 */
export function planInstanceDeletion(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instanceIds: readonly string[],
  sequence: number,
): SchematicEdit[] {
  const selected = selectedExistingInstanceIds(document, instanceIds);
  if (selected.size === 0) return [];

  return [
    ...planRoutedTerminalDetachment(document, resolver, selected, sequence),
    ...planTerminalDisconnections(document, selected),
    ...planNoConnectRemovals(document, selected),
    ...[...instanceOwnedAnnotationIds(document, selected)].map(
      (annotationId): SchematicEdit => ({
        kind: "remove_schematic_annotation",
        annotationId,
      }),
    ),
    ...planLayoutReferenceRemoval(document, selected),
    ...instancesById(document, selected).map((instance): SchematicEdit => ({
      kind: "remove_instance",
      instanceId: instance.id,
    })),
  ];
}

function selectedExistingInstanceIds(
  document: SchematicDocument,
  instanceIds: readonly string[],
): ReadonlySet<string> {
  const requested = new Set(instanceIds);
  return new Set(
    document.instances
      .filter((instance) => requested.has(instance.id))
      .map((instance) => instance.id),
  );
}

function instancesById(
  document: SchematicDocument,
  selected: ReadonlySet<string>,
) {
  return document.instances.filter((instance) => selected.has(instance.id));
}

function planRoutedTerminalDetachment(
  document: SchematicDocument,
  resolver: SymbolResolver,
  selected: ReadonlySet<string>,
  sequence: number,
): SchematicEdit[] {
  const replacements = new Map<string, RouteEndpoint>();
  const junctionEdits: SchematicEdit[] = [];
  const occupiedIds = new Set(
    [
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.noConnects,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
      ...(document.drafting?.objects ?? []),
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
      if (!usedByRoute) continue;

      const position = resolveEndpointPoint(document, resolver, endpoint);
      if (!position) {
        throw new Error(`Cannot preserve unresolved endpoint ${key}`);
      }
      let junctionId: string;
      do {
        junctionCounter += 1;
        junctionId = `junction-lifecycle-${sequence}-${junctionCounter}`;
      } while (occupiedIds.has(junctionId));
      occupiedIds.add(junctionId);
      replacements.set(key, { kind: "junction", junctionId });
      junctionEdits.push({
        kind: "add_junction",
        junctionId,
        netId: net.id,
        position,
      });
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

  return [...junctionEdits, ...routeEdits];
}

function planTerminalDisconnections(
  document: SchematicDocument,
  selected: ReadonlySet<string>,
): SchematicEdit[] {
  return document.nets.flatMap((net) =>
    net.terminals
      .filter((terminal) => selected.has(terminal.instanceId))
      .map((terminal): SchematicEdit => ({
        kind: "disconnect_endpoint",
        endpoint: { kind: "terminal", ...terminal },
      })),
  );
}

function planNoConnectRemovals(
  document: SchematicDocument,
  selected: ReadonlySet<string>,
): SchematicEdit[] {
  return document.noConnects
    .filter((noConnect) => selected.has(noConnect.endpoint.instanceId))
    .map((noConnect): SchematicEdit => ({
      kind: "remove_no_connect",
      noConnectId: noConnect.id,
    }));
}

/** Every annotation that would be orphaned by deleting any selected Instance. */
export function instanceOwnedAnnotationIds(
  document: SchematicDocument,
  instanceIds: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  const selected = new Set(instanceIds);
  return new Set(
    document.annotations
      .filter((annotation) => {
        if (
          annotation.anchor.kind === "object" &&
          selected.has(annotation.anchor.objectId)
        ) {
          return true;
        }
        const binding = annotation.binding;
        return (
          binding !== undefined &&
          binding.kind !== "net-name" &&
          binding.kind !== "cell-terminal-name" &&
          selected.has(binding.instanceId)
        );
      })
      .map((annotation) => annotation.id),
  );
}

function planLayoutReferenceRemoval(
  document: SchematicDocument,
  selected: ReadonlySet<string>,
): SchematicEdit[] {
  const groupEdits = document.layoutGroups.flatMap((group): SchematicEdit[] => {
    const objectIds = group.objectIds.filter((id) => !selected.has(id));
    if (objectIds.length === group.objectIds.length) return [];
    if (objectIds.length === 0) {
      return [{ kind: "remove_layout_group", groupId: group.id }];
    }
    return [{ kind: "set_layout_group", group: { ...group, objectIds } }];
  });
  const constraintEdits = document.constraints.flatMap(
    (constraint): SchematicEdit[] => {
      const objectIds = constraint.objectIds.filter((id) => !selected.has(id));
      if (objectIds.length === constraint.objectIds.length) return [];
      if (objectIds.length < 2) {
        return [
          { kind: "remove_layout_constraint", constraintId: constraint.id },
        ];
      }
      return [
        {
          kind: "set_layout_constraint",
          constraint: { ...constraint, objectIds },
        },
      ];
    },
  );
  return [...groupEdits, ...constraintEdits];
}
