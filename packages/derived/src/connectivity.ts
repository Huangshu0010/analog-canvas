import { deriveStableId } from "@icm/model";
import type { Net, Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  endpointKey,
  isVisibleEndpoint,
  netEndpoints,
  resolveEndpointPoint,
} from "./endpoint.js";

export interface VisibleConnectivityNode {
  key: string;
  endpoint: RouteEndpoint;
  point: Point | null;
}

export interface RoutedComponent {
  id: string;
  netId: string;
  nodes: VisibleConnectivityNode[];
}

export interface VisibleNetConnectivity {
  netId: string;
  components: RoutedComponent[];
}

export interface Flightline {
  id: string;
  netId: string;
  from: RouteEndpoint;
  to: RouteEndpoint;
  fromPoint: Point;
  toPoint: Point;
  distance: number;
}

class DisjointSet {
  readonly #parent = new Map<string, string>();

  add(key: string): void {
    if (!this.#parent.has(key)) this.#parent.set(key, key);
  }

  find(key: string): string {
    const parent = this.#parent.get(key);
    if (!parent) throw new Error(`Unknown visible-connectivity node: ${key}`);
    if (parent === key) return key;
    const root = this.find(parent);
    this.#parent.set(key, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    this.#parent.set(second!, first!);
  }
}

export function deriveNetConnectivity(
  document: SchematicDocument,
  resolver: SymbolResolver,
  net: Net,
): VisibleNetConnectivity {
  const endpoints = netEndpoints(document, net).filter((endpoint) =>
    isVisibleEndpoint(document, resolver, endpoint),
  );
  const nodes = new Map(
    endpoints.map((endpoint) => {
      const key = endpointKey(endpoint);
      return [
        key,
        {
          key,
          endpoint,
          point: resolveEndpointPoint(document, resolver, endpoint),
        },
      ];
    }),
  );
  const sets = new DisjointSet();
  for (const key of nodes.keys()) sets.add(key);
  for (const route of document.routes.filter(
    (candidate) => candidate.netId === net.id,
  )) {
    const from = endpointKey(route.from);
    const to = endpointKey(route.to);
    if (nodes.has(from) && nodes.has(to)) sets.union(from, to);
  }
  const labeledJunctions = new Map<string, string[]>();
  for (const annotation of document.annotations) {
    if (
      (annotation.kind !== "net-label" && annotation.kind !== "power-label") ||
      !annotation.attachedObjectId
    ) {
      continue;
    }
    const junction = document.junctions.find(
      (candidate) => candidate.id === annotation.attachedObjectId,
    );
    if (!junction || junction.netId !== net.id) continue;
    const key = endpointKey({ kind: "junction", junctionId: junction.id });
    if (!nodes.has(key)) continue;
    const label = annotation.text.trim();
    if (label.length === 0) continue;
    const group = labeledJunctions.get(label) ?? [];
    group.push(key);
    labeledJunctions.set(label, group);
  }
  for (const keys of labeledJunctions.values()) {
    const first = keys[0];
    if (!first) continue;
    for (const key of keys.slice(1)) sets.union(first, key);
  }
  const grouped = new Map<string, VisibleConnectivityNode[]>();
  for (const node of nodes.values()) {
    const root = sets.find(node.key);
    const group = grouped.get(root) ?? [];
    group.push(node);
    grouped.set(root, group);
  }
  const components = [...grouped.values()]
    .map((componentNodes) => {
      componentNodes.sort((left, right) =>
        left.key.localeCompare(right.key, "en"),
      );
      return {
        id: deriveStableId("component", net.id, componentNodes[0]!.key),
        netId: net.id,
        nodes: componentNodes,
      };
    })
    .sort((left, right) =>
      left.nodes[0]!.key.localeCompare(right.nodes[0]!.key, "en"),
    );
  return { netId: net.id, components };
}

export function deriveVisibleConnectivity(
  document: SchematicDocument,
  resolver: SymbolResolver,
): VisibleNetConnectivity[] {
  return [...document.nets]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((net) => deriveNetConnectivity(document, resolver, net));
}

function manhattan(left: Point, right: Point): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function componentAnchor(
  component: RoutedComponent,
): VisibleConnectivityNode | null {
  const positioned = component.nodes.filter(
    (node): node is VisibleConnectivityNode & { point: Point } =>
      node.point !== null,
  );
  if (positioned.length === 0) return null;
  return positioned
    .map((candidate) => ({
      candidate,
      cost: positioned.reduce(
        (sum, other) => sum + manhattan(candidate.point, other.point),
        0,
      ),
    }))
    .sort(
      (left, right) =>
        left.cost - right.cost ||
        left.candidate.key.localeCompare(right.candidate.key, "en"),
    )[0]!.candidate;
}

export function deriveFlightlines(
  document: SchematicDocument,
  resolver: SymbolResolver,
): Flightline[] {
  const result: Flightline[] = [];
  for (const net of [...document.nets].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  )) {
    const anchors = deriveNetConnectivity(document, resolver, net)
      .components.map(componentAnchor)
      .filter(
        (anchor): anchor is VisibleConnectivityNode & { point: Point } =>
          anchor !== null,
      );
    if (anchors.length < 2) continue;
    const edges = [];
    for (let left = 0; left < anchors.length; left += 1) {
      for (let right = left + 1; right < anchors.length; right += 1) {
        const from = anchors[left]!;
        const to = anchors[right]!;
        edges.push({
          from,
          to,
          distance: manhattan(from.point, to.point),
        });
      }
    }
    edges.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.from.key.localeCompare(right.from.key, "en") ||
        left.to.key.localeCompare(right.to.key, "en"),
    );
    const sets = new DisjointSet();
    for (const anchor of anchors) sets.add(anchor.key);
    for (const edge of edges) {
      if (sets.find(edge.from.key) === sets.find(edge.to.key)) continue;
      sets.union(edge.from.key, edge.to.key);
      result.push({
        id: deriveStableId("flightline", net.id, edge.from.key, edge.to.key),
        netId: net.id,
        from: edge.from.endpoint,
        to: edge.to.endpoint,
        fromPoint: edge.from.point,
        toPoint: edge.to.point,
        distance: edge.distance,
      });
    }
  }
  return result;
}
