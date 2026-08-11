import { deriveInternalGroupSelection } from "@icm/derived";
import type { SchematicEdit } from "@icm/edit-engine";
import type {
  Annotation,
  Instance,
  Net,
  Point,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";

export interface SchematicClipboard {
  instances: Instance[];
  nets: Net[];
  routes: RouteBranch[];
  junctions: SchematicDocument["junctions"];
  annotations: Annotation[];
}

export interface PasteProposal {
  edits: SchematicEdit[];
  instanceIds: string[];
}

/**
 * Returns the stable local origin used to attach a copied subgraph to the
 * pointer. Prefer an instance origin because it is also the point designers
 * intuitively grab when duplicating a component group.
 */
export function clipboardPlacementAnchor(
  clipboard: SchematicClipboard,
): Point | null {
  return (
    clipboard.instances.find((instance) => instance.placement)?.placement
      ?.position ??
    clipboard.junctions[0]?.position ??
    clipboard.routes[0]?.waypoints[0] ??
    clipboard.annotations[0]?.position ??
    null
  );
}

/**
 * Builds an isolated, translated formal document for the canvas-only copy
 * ghost. It never enters persistence or the edit engine; the final click still
 * uses proposePaste() below to create stable IDs and typed edits.
 */
export function clipboardPreviewDocument(
  base: SchematicDocument,
  clipboard: SchematicClipboard,
  offset: Point,
): SchematicDocument {
  const annotations = clipboard.annotations.map((annotation) => {
    const preview = structuredClone(annotation);
    preview.position = movePoint(preview.position, offset);
    if (preview.anchor?.kind === "free") {
      preview.anchor.position = movePoint(preview.anchor.position, offset);
    } else if (preview.anchor && "fallbackPosition" in preview.anchor) {
      preview.anchor.fallbackPosition = movePoint(
        preview.anchor.fallbackPosition,
        offset,
      );
    }
    return preview;
  });
  return {
    ...base,
    instances: clipboard.instances.map((instance) => ({
      ...structuredClone(instance),
      placement: instance.placement
        ? {
            ...instance.placement,
            position: movePoint(instance.placement.position, offset),
          }
        : null,
    })),
    nets: structuredClone(clipboard.nets),
    routes: clipboard.routes.map((route) => ({
      ...structuredClone(route),
      waypoints: route.waypoints.map((point) => movePoint(point, offset)),
    })),
    junctions: clipboard.junctions.map((junction) => ({
      ...structuredClone(junction),
      position: movePoint(junction.position, offset),
    })),
    ports: [],
    annotations,
    drafting: undefined,
  };
}

export function copySelection(
  document: SchematicDocument,
  instanceIds: readonly string[],
): SchematicClipboard | null {
  const selectedIds = new Set(instanceIds);
  const instances = document.instances.filter((instance) =>
    selectedIds.has(instance.id),
  );
  if (instances.length === 0) return null;
  const internal = deriveInternalGroupSelection(document, instanceIds);
  const netIds = new Set(internal.netIds);
  const routeIds = new Set(internal.routeIds);
  const junctionIds = new Set(internal.junctionIds);
  const attachedIds = new Set<string>([
    ...selectedIds,
    ...netIds,
    ...routeIds,
    ...junctionIds,
  ]);
  return structuredClone({
    instances,
    nets: document.nets.filter((net) => netIds.has(net.id)),
    routes: document.routes.filter((route) => routeIds.has(route.id)),
    junctions: document.junctions.filter((junction) =>
      junctionIds.has(junction.id),
    ),
    annotations: document.annotations.filter(
      (annotation) =>
        (annotation.attachedObjectId !== undefined &&
          attachedIds.has(annotation.attachedObjectId)) ||
        (annotation.routeAttachment !== undefined &&
          routeIds.has(annotation.routeAttachment.routeId)) ||
        (annotation.anchor?.kind === "route" &&
          routeIds.has(annotation.anchor.routeId)),
    ),
  });
}

function uniqueCopyId(
  sourceId: string,
  sequence: number,
  occupied: Set<string>,
): string {
  let candidate = `${sourceId}-copy-${sequence}`;
  let collision = 1;
  while (occupied.has(candidate)) {
    collision += 1;
    candidate = `${sourceId}-copy-${sequence}-${collision}`;
  }
  occupied.add(candidate);
  return candidate;
}

function movePoint(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function mapEndpoint(
  endpoint: RouteEndpoint,
  instanceIds: ReadonlyMap<string, string>,
  junctionIds: ReadonlyMap<string, string>,
): RouteEndpoint {
  switch (endpoint.kind) {
    case "terminal":
      return {
        ...endpoint,
        instanceId: instanceIds.get(endpoint.instanceId) ?? endpoint.instanceId,
      };
    case "junction":
      return {
        ...endpoint,
        junctionId: junctionIds.get(endpoint.junctionId) ?? endpoint.junctionId,
      };
    case "port":
      return endpoint;
  }
}

function firstNetEndpoint(net: Net): RouteEndpoint | null {
  const terminal = net.terminals[0];
  if (terminal) return { kind: "terminal", ...terminal };
  const portId = net.ports[0];
  return portId ? { kind: "port", portId } : null;
}

export function proposePaste(
  document: SchematicDocument,
  clipboard: SchematicClipboard,
  offset: Point,
  sequence: number,
): PasteProposal {
  const occupied = new Set<string>(
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
  const instanceIds = new Map(
    clipboard.instances.map((instance) => [
      instance.id,
      uniqueCopyId(instance.id, sequence, occupied),
    ]),
  );
  const routeIds = new Map(
    clipboard.routes.map((route) => [
      route.id,
      uniqueCopyId(route.id, sequence, occupied),
    ]),
  );
  const junctionIds = new Map(
    clipboard.junctions.map((junction) => [
      junction.id,
      uniqueCopyId(junction.id, sequence, occupied),
    ]),
  );
  const netIds = new Map<string, string>();
  const existingAnchors = new Map<string, RouteEndpoint>();
  for (const net of clipboard.nets) {
    const existing = net.name
      ? document.nets.find((candidate) => candidate.name === net.name)
      : undefined;
    if (existing) {
      netIds.set(net.id, existing.id);
      const anchor = firstNetEndpoint(existing);
      if (anchor) existingAnchors.set(net.id, anchor);
    } else {
      netIds.set(net.id, uniqueCopyId(net.id, sequence, occupied));
    }
  }
  const objectIds = new Map<string, string>([
    ...instanceIds,
    ...netIds,
    ...routeIds,
    ...junctionIds,
  ]);
  const edits: SchematicEdit[] = clipboard.instances.map(
    (instance): SchematicEdit => ({
      kind: "add_instance",
      instance: {
        ...structuredClone(instance),
        id: instanceIds.get(instance.id)!,
        placement: instance.placement
          ? {
              ...instance.placement,
              position: movePoint(instance.placement.position, offset),
            }
          : null,
      },
    }),
  );

  for (const net of clipboard.nets) {
    const mappedTerminals = net.terminals.map((terminal): RouteEndpoint => ({
      kind: "terminal",
      instanceId: instanceIds.get(terminal.instanceId)!,
      pinName: terminal.pinName,
    }));
    const netId = netIds.get(net.id)!;
    const existingAnchor = existingAnchors.get(net.id);
    if (existingAnchor) {
      for (const terminal of mappedTerminals) {
        edits.push({
          kind: "connect_endpoints",
          from: existingAnchor,
          to: terminal,
        });
      }
    } else if (mappedTerminals[0]) {
      edits.push({
        kind: "connect_endpoints",
        from: mappedTerminals[0],
        to: mappedTerminals[1] ?? mappedTerminals[0],
        newNetId: netId,
        ...(net.name ? { newNetName: net.name } : {}),
      });
      for (const terminal of mappedTerminals.slice(2)) {
        edits.push({
          kind: "connect_endpoints",
          from: mappedTerminals[0],
          to: terminal,
        });
      }
    }
  }
  edits.push(
    ...clipboard.junctions.map((junction): SchematicEdit => ({
      kind: "add_junction",
      junctionId: junctionIds.get(junction.id)!,
      netId: netIds.get(junction.netId)!,
      position: movePoint(junction.position, offset),
    })),
  );
  edits.push(
    ...clipboard.routes.map((route): SchematicEdit => ({
      kind: "set_route_points",
      routeId: routeIds.get(route.id)!,
      netId: netIds.get(route.netId)!,
      from: mapEndpoint(route.from, instanceIds, junctionIds),
      to: mapEndpoint(route.to, instanceIds, junctionIds),
      waypoints: route.waypoints.map((point) => movePoint(point, offset)),
      segmentModes: [...route.segmentModes],
    })),
  );
  edits.push(
    ...clipboard.annotations.map((annotation): SchematicEdit => ({
      kind: "upsert_annotation",
      annotation: {
        ...structuredClone(annotation),
        id: uniqueCopyId(annotation.id, sequence, occupied),
        position: movePoint(annotation.position, offset),
        ...(annotation.attachedObjectId
          ? {
              attachedObjectId:
                objectIds.get(annotation.attachedObjectId) ??
                annotation.attachedObjectId,
            }
          : {}),
        ...(annotation.routeAttachment
          ? {
              routeAttachment: {
                ...annotation.routeAttachment,
                routeId:
                  routeIds.get(annotation.routeAttachment.routeId) ??
                  annotation.routeAttachment.routeId,
              },
            }
          : {}),
        // ADR 0010: a route-marker's route association lives on its VisualAnchor.
        ...(annotation.anchor?.kind === "route"
          ? {
              anchor: {
                ...annotation.anchor,
                routeId:
                  routeIds.get(annotation.anchor.routeId) ??
                  annotation.anchor.routeId,
              },
            }
          : {}),
      },
    })),
  );
  return { edits, instanceIds: [...instanceIds.values()] };
}
