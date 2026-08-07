// Route-graph geometry helper.
//
// Per ADR 0008: the Agent gives a complete local Route graph (nodes + edges);
// this helper only projects each edge onto legal coordinates (grid snap,
// terminal escape, orthogonal geometry, trunk split, stable IDs, typed-edit
// assembly). It NEVER decides topology, adds a missing node, switches a shape,
// or reroutes. Conflicts are returned, never silently resolved.

import type { Point, RouteEndpoint } from "@icm/model";
import type { SchematicEdit } from "@icm/edit-engine";
import type {
  AlignAxis,
  ExpansionConflict,
  ResolvedEndpoint,
  RouteEdgeRole,
  RouteGraph,
  RouteGraphEdge,
  RouteGraphNode,
  RouteGraphExpansion,
  SegmentMode,
} from "./types.js";

/** The fixed-style coordinate canon (see razavi-style-canon.md). */
const GRID = 10;

export interface InstanceBox {
  instanceId: string;
  /** Inclusive bounds of the placed symbol silhouette. */
  min: Point;
  max: Point;
}

/**
 * The Snapshot-derived input slice the helper reads. Built by the caller from
 * a complete AgentSessionSnapshot; the helper never touches the Snapshot
 * schema, the Adapter, or the Model directly.
 */
export interface ExpansionInput {
  /** Endpoint id -> resolved page coordinate and outward direction. */
  endpoints: ReadonlyMap<string, ResolvedEndpoint>;
  /** Existing committed Routes (for overlap/crossing detection only). */
  existingRoutePolylines: ReadonlyArray<{ routeId: string; points: Point[] }>;
  /** Placed-instance silhouettes (for wire-through-symbol detection only). */
  instanceBoxes: ReadonlyArray<InstanceBox>;
}

/**
 * JSON-friendly form of ExpansionInput. A `Map` cannot survive JSON.parse, so
 * the Skill caller (and any out-of-process caller) sends `endpoints` as an
 * array and hydrates it into a Map via `hydrateExpansionInput`.
 */
export interface SerializedExpansionInput {
  endpoints: ReadonlyArray<ResolvedEndpoint>;
  existingRoutePolylines: ReadonlyArray<{ routeId: string; points: Point[] }>;
  instanceBoxes: ReadonlyArray<InstanceBox>;
}

/** Build an ExpansionInput from its JSON-serializable form. */
export function hydrateExpansionInput(
  input: SerializedExpansionInput,
): ExpansionInput {
  const endpoints = new Map<string, ResolvedEndpoint>();
  for (const endpoint of input.endpoints) {
    endpoints.set(endpoint.id, endpoint);
  }
  return {
    endpoints,
    existingRoutePolylines: input.existingRoutePolylines,
    instanceBoxes: input.instanceBoxes,
  };
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Expand a Route graph into typed edits + resolved geometry + metrics.
 *
 * Returns a conflict (no edits) when a node's position cannot be resolved or
 * an edge references an unknown node. Never invents a node or edge, never
 * reroutes, never switches a shape.
 */
export function expandRouteGraph(
  graph: RouteGraph,
  input: ExpansionInput,
): RouteGraphExpansion {
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteGraphExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];

  // 1. Resolve every node's coordinate.
  const nodeCoords = new Map<string, Point>();
  const nodeOutward = new Map<string, Point | null>();
  const endpointNodes = new Map<string, RouteEndpoint>();
  const junctionIds = new Set<string>();

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  // Pass 1: endpoint nodes (their coordinate comes from the input slice).
  for (const node of graph.nodes) {
    if (node.role !== "endpoint") continue;
    if (!node.endpoint) {
      conflicts.push({
        code: "MISSING_ENDPOINT_REF",
        message: `Endpoint node ${node.id} has no endpoint reference`,
        objectIds: [node.id],
      });
      continue;
    }
    // The endpoint must be resolvable via the input. The caller keys endpoints
    // by a stable id; we look up by the node's endpoint identity.
    const resolved = resolveEndpointInInput(node.endpoint, input);
    if (!resolved) {
      conflicts.push({
        code: "MISSING_ENDPOINT",
        message: `Endpoint node ${node.id} is not present in the input`,
        objectIds: [node.id],
      });
      continue;
    }
    nodeCoords.set(node.id, resolved.point);
    nodeOutward.set(node.id, resolved.outward);
    endpointNodes.set(node.id, node.endpoint);
  }

  // Pass 2: positioned nodes (tap/junction/label-anchor). Resolve `at` first,
  // then `alignWith`, so a node can align with one already resolved.
  let changed = true;
  let passes = 0;
  while (changed && passes < graph.nodes.length + 1) {
    changed = false;
    passes += 1;
    for (const node of graph.nodes) {
      if (nodeCoords.has(node.id)) continue;
      if (node.role === "endpoint") continue;
      const pos = resolvePositionedNode(node, nodeCoords);
      if (pos) {
        const snapped = { x: snap(pos.x), y: snap(pos.y) };
        nodeCoords.set(node.id, snapped);
        nodeOutward.set(node.id, null);
        junctionIds.add(node.id);
        changed = true;
      }
    }
  }

  // Any positioned node still unresolved is a conflict (no median guess).
  for (const node of graph.nodes) {
    if (node.role === "endpoint") continue;
    if (!nodeCoords.has(node.id)) {
      conflicts.push({
        code: "MISSING_NODE_POSITION",
        message: `Node ${node.id} (${node.role}) has no resolvable position (needs at or alignWith+axis)`,
        objectIds: [node.id],
      });
    }
  }

  // 2. Emit add_junction for every tap/junction/label-anchor node.
  for (const node of graph.nodes) {
    if (node.role === "endpoint") continue;
    const point = nodeCoords.get(node.id);
    if (!point) continue;
    edits.push({
      kind: "add_junction",
      junctionId: node.id,
      netId: graph.netId,
      position: { ...point },
    });
    assumptions.push(
      `node ${node.id} (${node.role}) at (${point.x},${point.y})`,
    );
  }

  // 3. For each edge, emit exactly one typed edit.
  let edgeIndex = 0;
  for (const edge of graph.edges) {
    edgeIndex += 1;
    const from = nodeCoords.get(edge.from);
    const to = nodeCoords.get(edge.to);
    if (!from || !to) {
      conflicts.push({
        code: "EDGE_UNRESOLVED_NODE",
        message: `Edge ${edge.id} references an unresolved node`,
        objectIds: [edge.id],
      });
      continue;
    }
    const fromEndpoint = endpointNodes.get(edge.from);
    const toEndpoint = endpointNodes.get(edge.to);
    const routeId = `route-${graph.netId}-${edgeIndex}`;

    switch (edge.role) {
      case "escape": {
        // An escape edge connects an endpoint to a junction. Use
        // route_orthogonal so the Engine computes the pin-aware escape.
        const terminalEndpoint = fromEndpoint ?? toEndpoint;
        const junctionId = fromEndpoint ? edge.to : edge.from;
        if (!terminalEndpoint || !junctionIds.has(junctionId)) {
          conflicts.push({
            code: "ESCAPE_MALFORMED",
            message: `Escape edge ${edge.id} must connect an endpoint to a tap/junction`,
            objectIds: [edge.id],
          });
          continue;
        }
        edits.push({
          kind: "route_orthogonal",
          routeId,
          netId: graph.netId,
          from: terminalEndpoint,
          to: { kind: "junction", junctionId },
        });
        resolvedGeometry.push({ routeId, points: [from, to] });
        break;
      }
      case "trunk": {
        if (!junctionIds.has(edge.from) || !junctionIds.has(edge.to)) {
          conflicts.push({
            code: "TRUNK_MALFORMED",
            message: `Trunk edge ${edge.id} must connect two tap/junction nodes`,
            objectIds: [edge.id],
          });
          continue;
        }
        edits.push(
          setRouteEdit(
            routeId,
            graph.netId,
            { kind: "junction", junctionId: edge.from },
            { kind: "junction", junctionId: edge.to },
            [],
            [edge.segmentMode ?? "trunk"],
          ),
        );
        resolvedGeometry.push({ routeId, points: [from, to] });
        break;
      }
      case "link": {
        // A link connects two nodes (endpoints or junctions) that may not be
        // axis-aligned. Use route_orthogonal so the Engine computes a compliant
        // path; segmentMode is advisory for the Agent's intent.
        edits.push({
          kind: "route_orthogonal",
          routeId,
          netId: graph.netId,
          from: routeEndpointFor(edge.from, endpointNodes, junctionIds),
          to: routeEndpointFor(edge.to, endpointNodes, junctionIds),
        });
        resolvedGeometry.push({ routeId, points: [from, to] });
        break;
      }
      case "label": {
        const text = edge.label?.text ?? "";
        const attachedObjectId = edge.label?.attachedObjectId ?? edge.to;
        edits.push({
          kind: "upsert_annotation",
          annotation: {
            id: routeId,
            kind: "net-label",
            text,
            position: { x: to.x, y: to.y },
            attachedObjectId,
            offset: { x: 0, y: 0 },
            alignment: "middle",
            rotation: 0,
            locked: false,
          },
        });
        assumptions.push(`label "${text}" at node ${edge.to}`);
        break;
      }
    }
  }

  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

// --- node coordinate resolution ---

function resolveEndpointInInput(
  endpoint: RouteEndpoint,
  input: ExpansionInput,
): ResolvedEndpoint | undefined {
  for (const candidate of input.endpoints.values()) {
    if (sameEndpoint(candidate.endpoint, endpoint)) return candidate;
  }
  return undefined;
}

function sameEndpoint(a: RouteEndpoint, b: RouteEndpoint): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "terminal" && b.kind === "terminal") {
    return a.instanceId === b.instanceId && a.pinName === b.pinName;
  }
  if (a.kind === "port" && b.kind === "port") {
    return a.portId === b.portId;
  }
  if (a.kind === "junction" && b.kind === "junction") {
    return a.junctionId === b.junctionId;
  }
  return false;
}

function resolvePositionedNode(
  node: RouteGraphNode,
  resolved: Map<string, Point>,
): Point | undefined {
  if (node.at) return node.at;
  if (!node.alignWith || !node.axis) return undefined;
  const ref = resolved.get(node.alignWith);
  if (!ref) return undefined;
  const offset = node.offset ?? 0;
  if (node.axis === "x") {
    // share x; perpendicular (y) = ref.y + offset
    return { x: ref.x, y: ref.y + offset };
  }
  // axis === "y": share y; perpendicular (x) = ref.x + offset
  return { x: ref.x + offset, y: ref.y };
}

// --- edit builders ---

function routeEndpointFor(
  nodeId: string,
  endpointNodes: Map<string, RouteEndpoint>,
  junctionIds: Set<string>,
): RouteEndpoint {
  const ep = endpointNodes.get(nodeId);
  if (ep) return ep;
  if (junctionIds.has(nodeId)) return { kind: "junction", junctionId: nodeId };
  // Fallback: treat as junction (will surface as a conflict upstream if invalid).
  return { kind: "junction", junctionId: nodeId };
}

function setRouteEdit(
  routeId: string,
  netId: string,
  from: RouteEndpoint,
  to: RouteEndpoint,
  waypoints: Point[],
  segmentModes: SegmentMode[],
): SchematicEdit {
  return {
    kind: "set_route_points",
    routeId,
    netId,
    from,
    to,
    waypoints,
    segmentModes,
  };
}

// --- assembly ---

function assemble(
  edits: SchematicEdit[],
  resolvedGeometry: RouteGraphExpansion["resolvedGeometry"],
  assumptions: string[],
  conflicts: ExpansionConflict[],
): RouteGraphExpansion {
  return {
    edits,
    generatedObjectIds: collectIds(edits),
    resolvedGeometry,
    metrics: computeMetrics(edits, resolvedGeometry),
    assumptions,
    conflicts,
  };
}

function collectIds(edits: SchematicEdit[]): string[] {
  const ids: string[] = [];
  for (const edit of edits) {
    if (edit.kind === "add_junction") ids.push(edit.junctionId);
    if (edit.kind === "set_route_points" || edit.kind === "route_orthogonal")
      ids.push(edit.routeId);
    if (edit.kind === "upsert_annotation") ids.push(edit.annotation.id);
  }
  return ids;
}

function computeMetrics(
  edits: SchematicEdit[],
  resolvedGeometry: RouteGraphExpansion["resolvedGeometry"],
): RouteGraphExpansion["metrics"] {
  let totalRouteLength = 0;
  let bendCount = 0;
  for (const route of resolvedGeometry) {
    for (let index = 1; index < route.points.length; index += 1) {
      totalRouteLength += manhattan(
        route.points[index - 1]!,
        route.points[index]!,
      );
    }
    bendCount += Math.max(0, route.points.length - 2);
  }
  return {
    routeCount: edits.filter(
      (edit) =>
        edit.kind === "set_route_points" || edit.kind === "route_orthogonal",
    ).length,
    junctionCount: edits.filter((edit) => edit.kind === "add_junction").length,
    totalRouteLength,
    bendCount,
  };
}
