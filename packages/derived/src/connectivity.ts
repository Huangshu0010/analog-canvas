import { deriveStableId } from "@icm/model";
import type { Net, Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  endpointKey,
  isVisibleEndpoint,
  netEndpoints,
  resolveEndpointPoint,
} from "./endpoint.js";
import { resolveNetLabelBindings } from "./net-label.js";

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
  const labeledEndpoints = new Map<string, string[]>();
  for (const binding of resolveNetLabelBindings(document, resolver, net.id)) {
    const annotation = document.annotations.find(
      (candidate) => candidate.id === binding.annotationId,
    )!;
    const label = annotation.text.trim();
    const key = endpointKey(binding.endpoint);
    if (label.length === 0 || !nodes.has(key)) continue;
    const group = labeledEndpoints.get(label) ?? [];
    group.push(key);
    labeledEndpoints.set(label, group);
  }
  // Power labels retain their existing Junction attachment until their own
  // symbol/instance binding contract is migrated. Net Labels never enter this
  // compatibility path: their attachedObjectId is exclusively a Net id.
  for (const annotation of document.annotations) {
    if (annotation.kind !== "power-label" || !annotation.attachedObjectId) {
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
    const group = labeledEndpoints.get(label) ?? [];
    group.push(key);
    labeledEndpoints.set(label, group);
  }
  for (const keys of labeledEndpoints.values()) {
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

function straightLineDistance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function flightlineNodePriority(
  document: SchematicDocument,
  node: VisibleConnectivityNode,
): number {
  if (node.endpoint.kind !== "junction") return 1;
  const junctionId = node.endpoint.junctionId;
  const junction = document.junctions.find(
    (candidate) => candidate.id === junctionId,
  );
  const degree = document.routes.filter(
    (route) =>
      (route.from.kind === "junction" &&
        route.from.junctionId === junctionId) ||
      (route.to.kind === "junction" && route.to.junctionId === junctionId),
  ).length;
  return junction?.role === "route-anchor" && degree <= 1 ? 0 : 2;
}

export function deriveFlightlines(
  document: SchematicDocument,
  resolver: SymbolResolver,
): Flightline[] {
  const result: Flightline[] = [];
  for (const net of [...document.nets].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  )) {
    const components = deriveNetConnectivity(document, resolver, net)
      .components.map((component) => ({
        ...component,
        nodes: component.nodes.filter(
          (node): node is VisibleConnectivityNode & { point: Point } =>
            node.point !== null,
        ),
      }))
      .filter((component) => component.nodes.length > 0);
    if (components.length < 2) continue;
    const edges: Array<{
      fromComponentId: string;
      toComponentId: string;
      from: VisibleConnectivityNode & { point: Point };
      to: VisibleConnectivityNode & { point: Point };
      distance: number;
      priority: number;
    }> = [];
    for (let left = 0; left < components.length; left += 1) {
      for (let right = left + 1; right < components.length; right += 1) {
        const fromComponent = components[left]!;
        const toComponent = components[right]!;
        const best = fromComponent.nodes
          .flatMap((from) =>
            toComponent.nodes.map((to) => ({
              from,
              to,
              distance: straightLineDistance(from.point, to.point),
              priority:
                flightlineNodePriority(document, from) +
                flightlineNodePriority(document, to),
            })),
          )
          .sort(
            (leftCandidate, rightCandidate) =>
              leftCandidate.distance - rightCandidate.distance ||
              leftCandidate.priority - rightCandidate.priority ||
              leftCandidate.from.key.localeCompare(
                rightCandidate.from.key,
                "en",
              ) ||
              leftCandidate.to.key.localeCompare(rightCandidate.to.key, "en"),
          )[0]!;
        edges.push({
          fromComponentId: fromComponent.id,
          toComponentId: toComponent.id,
          ...best,
        });
      }
    }
    edges.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.priority - right.priority ||
        left.from.key.localeCompare(right.from.key, "en") ||
        left.to.key.localeCompare(right.to.key, "en"),
    );
    const sets = new DisjointSet();
    for (const component of components) sets.add(component.id);
    for (const edge of edges) {
      if (sets.find(edge.fromComponentId) === sets.find(edge.toComponentId)) {
        continue;
      }
      sets.union(edge.fromComponentId, edge.toComponentId);
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
