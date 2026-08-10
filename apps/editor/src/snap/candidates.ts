import { resolveDraftingObjectGeometry } from "@icm/derived";
import type { Point, Rect, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { instanceVisibleHitBox } from "../selection-geometry";
import type { WireSource } from "../wire-editing";
import type { SnapAnchor, SnapTargetKind } from "./engine";

function boundsAnchors(prefix: string, bounds: Rect): SnapAnchor[] {
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  return [
    { id: `${prefix}:center`, point: center, kind: "instance-center" },
    {
      id: `${prefix}:left`,
      point: { x: bounds.x, y: center.y },
      kind: "instance-edge",
      axes: ["x"],
    },
    {
      id: `${prefix}:right`,
      point: { x: bounds.x + bounds.width, y: center.y },
      kind: "instance-edge",
      axes: ["x"],
    },
    {
      id: `${prefix}:top`,
      point: { x: center.x, y: bounds.y },
      kind: "instance-edge",
      axes: ["y"],
    },
    {
      id: `${prefix}:bottom`,
      point: { x: center.x, y: bounds.y + bounds.height },
      kind: "instance-edge",
      axes: ["y"],
    },
  ];
}

function endpointKind(source: WireSource): SnapTargetKind {
  switch (source.endpoint.kind) {
    case "terminal":
      return "pin";
    case "port":
      return "port";
    case "junction":
      return "junction";
  }
}

export function endpointSnapAnchor(source: WireSource): SnapAnchor {
  const endpointId =
    source.endpoint.kind === "terminal"
      ? `${source.endpoint.instanceId}:${source.endpoint.pinName}`
      : source.endpoint.kind === "port"
        ? source.endpoint.portId
        : source.endpoint.junctionId;
  return {
    id: `endpoint:${source.endpoint.kind}:${endpointId}`,
    point: source.point,
    kind: endpointKind(source),
    electrical: { endpoint: source.endpoint, netId: source.netId },
  };
}

function draftingGeometryPoints(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: NonNullable<SchematicDocument["drafting"]>["objects"][number],
): Point[] {
  const geometry = resolveDraftingObjectGeometry(document, resolver, object);
  switch (geometry.kind) {
    case "text":
    case "floating-symbol":
      return [geometry.position];
    case "arrow":
      return geometry.vertices;
    case "leader":
      return [geometry.anchor, geometry.target];
    case "callout":
      return [geometry.textPosition, geometry.target];
    case "construction-line":
      return geometry.vertices;
    case "rectangle":
      return [geometry.center, ...geometry.corners];
  }
}

export function buildDraftingAnchors(
  document: SchematicDocument,
  resolver: SymbolResolver,
  objectIds?: ReadonlySet<string>,
): SnapAnchor[] {
  return (document.drafting?.objects ?? []).flatMap((object) => {
    if (objectIds && !objectIds.has(object.id)) return [];
    return draftingGeometryPoints(document, resolver, object).map(
      (point, index): SnapAnchor => ({
        id: `drafting:${object.id}:${index}`,
        point,
        kind: "drafting",
      }),
    );
  });
}

export function buildInstanceAnchors(
  document: SchematicDocument,
  resolver: SymbolResolver,
  visibleEndpoints: readonly WireSource[],
  instanceIds: ReadonlySet<string>,
): SnapAnchor[] {
  const geometryAnchors = document.instances.flatMap((instance) => {
    if (!instanceIds.has(instance.id) || !instance.placement) return [];
    const resolved = resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    if (!resolved) return [];
    const bounds = instanceVisibleHitBox(instance, resolved);
    return [
      {
        id: `instance:${instance.id}:origin`,
        point: instance.placement.position,
        kind: "instance-center" as const,
      },
      ...(bounds ? boundsAnchors(`instance:${instance.id}`, bounds) : []),
    ];
  });
  const electricalAnchors = visibleEndpoints
    .filter(
      (source) =>
        source.endpoint.kind === "terminal" &&
        instanceIds.has(source.endpoint.instanceId),
    )
    .map(endpointSnapAnchor);
  return [...geometryAnchors, ...electricalAnchors];
}

export function buildSceneSnapTargets(
  document: SchematicDocument,
  resolver: SymbolResolver,
  visibleEndpoints: readonly WireSource[],
  excludedInstanceIds: ReadonlySet<string> = new Set(),
  excludedDraftingIds: ReadonlySet<string> = new Set(),
): SnapAnchor[] {
  const staticInstanceIds = new Set(
    document.instances
      .filter((instance) => !excludedInstanceIds.has(instance.id))
      .map((instance) => instance.id),
  );
  const instanceAnchors = buildInstanceAnchors(
    document,
    resolver,
    [],
    staticInstanceIds,
  );
  const endpointAnchors = visibleEndpoints
    .filter(
      (source) =>
        source.endpoint.kind !== "terminal" ||
        !excludedInstanceIds.has(source.endpoint.instanceId),
    )
    .map(endpointSnapAnchor);
  const guideAnchors = (document.drafting?.guides ?? [])
    .filter((guide) => guide.visible)
    .map((guide): SnapAnchor => ({
      id: `guide:${guide.id}`,
      point:
        guide.axis === "vertical"
          ? { x: guide.coordinate, y: 0 }
          : { x: 0, y: guide.coordinate },
      kind: "guide",
      axes: [guide.axis === "vertical" ? "x" : "y"],
    }));
  const draftingIds = new Set(
    (document.drafting?.objects ?? [])
      .filter((object) => !excludedDraftingIds.has(object.id))
      .map((object) => object.id),
  );
  return [
    ...instanceAnchors,
    ...endpointAnchors,
    ...guideAnchors,
    ...buildDraftingAnchors(document, resolver, draftingIds),
  ];
}
