import { transformPoint } from "@icm/model";
import type { Net, Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";
import { mosBulkShouldBeVisible } from "./mos-bulk.js";

export function endpointKey(endpoint: RouteEndpoint): string {
  switch (endpoint.kind) {
    case "terminal":
      return `terminal:${endpoint.instanceId}:${endpoint.pinName}`;
    case "port":
      return `port:${endpoint.portId}`;
    case "junction":
      return `junction:${endpoint.junctionId}`;
  }
}

export function endpointsEqual(
  left: RouteEndpoint,
  right: RouteEndpoint,
): boolean {
  return endpointKey(left) === endpointKey(right);
}

/**
 * Returns whether an endpoint participates in the visible wiring graph.
 * Electrical Net membership is intentionally not consulted or mutated here.
 * A variant-hidden pin is an implicit presentation terminal. A base
 * `conditional` pin stays visible until a context-aware policy explicitly
 * proves that hiding it is safe.
 */
export function isVisibleEndpoint(
  document: SchematicDocument,
  resolver: SymbolResolver,
  endpoint: RouteEndpoint,
): boolean {
  if (endpoint.kind !== "terminal") return true;
  const instance = document.instances.find(
    (candidate) => candidate.id === endpoint.instanceId,
  );
  if (!instance) return false;
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  if (!resolved) return false;
  if (resolved.variant?.hiddenPinNames.includes(endpoint.pinName)) {
    return Boolean(
      endpoint.pinName === "B" &&
      resolved.variant.auxiliaryPins?.some((pin) => pin.name === "B") &&
      mosBulkShouldBeVisible(document, instance),
    );
  }
  const pin = resolved.definition.pins.find(
    (candidate) => candidate.name === endpoint.pinName,
  );
  return pin !== undefined && pin.presentation.visibility !== "implicit";
}

export function resolveEndpointPoint(
  document: SchematicDocument,
  resolver: SymbolResolver,
  endpoint: RouteEndpoint,
): Point | null {
  switch (endpoint.kind) {
    case "port":
      return (
        document.ports.find((port) => port.id === endpoint.portId)?.position ??
        null
      );
    case "junction":
      return (
        document.junctions.find(
          (junction) => junction.id === endpoint.junctionId,
        )?.position ?? null
      );
    case "terminal": {
      const instance = document.instances.find(
        (candidate) => candidate.id === endpoint.instanceId,
      );
      if (!instance?.placement) return null;
      const symbol = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      const basePin = symbol?.definition.pins.find(
        (candidate) => candidate.name === endpoint.pinName,
      );
      if (!basePin) return null;
      const auxiliary = symbol?.variant?.auxiliaryPins?.find(
        (candidate) => candidate.name === endpoint.pinName,
      );
      const pin = auxiliary ?? basePin;
      return transformPoint(
        pin.at,
        instance.placement.position,
        instance.placement,
      );
    }
  }
}

export function resolveEndpointOutwardDirection(
  document: SchematicDocument,
  resolver: SymbolResolver,
  endpoint: RouteEndpoint,
): Point | null {
  if (endpoint.kind !== "terminal") return null;
  const instance = document.instances.find(
    (candidate) => candidate.id === endpoint.instanceId,
  );
  if (!instance?.placement) return null;
  const symbol = resolver.resolve(instance.symbolId, instance.symbolVariantId);
  const basePin = symbol?.definition.pins.find(
    (candidate) => candidate.name === endpoint.pinName,
  );
  if (!basePin) return null;
  const auxiliary = symbol?.variant?.auxiliaryPins?.find(
    (candidate) => candidate.name === endpoint.pinName,
  );
  const pin = auxiliary ?? basePin;
  const localDirection = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  }[pin.direction];
  return transformPoint(localDirection, { x: 0, y: 0 }, instance.placement);
}

export function endpointBelongsToNet(
  document: SchematicDocument,
  net: Net,
  endpoint: RouteEndpoint,
): boolean {
  switch (endpoint.kind) {
    case "terminal":
      return net.terminals.some(
        (terminal) =>
          terminal.instanceId === endpoint.instanceId &&
          terminal.pinName === endpoint.pinName,
      );
    case "port":
      return net.ports.includes(endpoint.portId);
    case "junction":
      return document.junctions.some(
        (junction) =>
          junction.id === endpoint.junctionId && junction.netId === net.id,
      );
  }
}

export function netEndpoints(
  document: SchematicDocument,
  net: Net,
): RouteEndpoint[] {
  return [
    ...net.terminals.map((terminal): RouteEndpoint => ({
      kind: "terminal",
      ...terminal,
    })),
    ...net.ports.map((portId): RouteEndpoint => ({ kind: "port", portId })),
    ...document.junctions
      .filter((junction) => junction.netId === net.id)
      .map((junction): RouteEndpoint => ({
        kind: "junction",
        junctionId: junction.id,
      })),
  ].sort((left, right) =>
    endpointKey(left).localeCompare(endpointKey(right), "en"),
  );
}
