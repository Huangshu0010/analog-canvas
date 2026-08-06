import { transformPoint } from "@icm/model";
import type { Net, Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

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
      const pin = symbol?.definition.pins.find(
        (candidate) => candidate.name === endpoint.pinName,
      );
      if (!pin) return null;
      return transformPoint(
        pin.at,
        instance.placement.position,
        instance.placement,
      );
    }
  }
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
