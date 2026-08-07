// Route-tree expander: turns a RouteTreeDecision (topology) into typed edits
// with resolved coordinates. Per ADR 0008: detects conflicts but does NOT
// auto-reroute. No `auto`/`best` shape. Never silently switches shapes.

import type { Point, RouteEndpoint } from "@icm/model";
import type { SchematicEdit } from "@icm/edit-engine";
import type {
  ExpansionConflict,
  RouteTreeDecision,
  RouteTreeExpansion,
  ResolvedEndpoint,
  RouteTreeShape,
} from "./types.js";

type SegmentMode = Extract<
  SchematicEdit,
  { kind: "set_route_points" }
>["segmentModes"][number];

/** The fixed-style coordinate canon (see razavi-style-canon.md). */
const GRID = 10;

export interface InstanceBox {
  instanceId: string;
  /** Inclusive bounds of the placed symbol silhouette. */
  min: Point;
  max: Point;
}

/**
 * The Snapshot-derived input slice the expander reads. Built by the caller from
 * a complete AgentSessionSnapshot; the expander never touches the Snapshot
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

const SHAPES: ReadonlySet<RouteTreeShape> = new Set([
  "direct",
  "local-branch-tree",
  "shared-trunk",
  "labeled-islands",
  "ordered-bus",
]);

let idCounter = 0;
/**
 * Deterministic id generator. The expander must not use Math.random/Date.now
 * (workflow scripts forbid them); callers seed via a stable document/net
 * prefix so ids are reproducible across runs with the same input.
 */
function stableId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function resetIdCounter(): void {
  idCounter = 0;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function orthoLShape(
  from: Point,
  to: Point,
  horizontalFirst: boolean,
): Point[] {
  if (horizontalFirst) {
    return [from, { x: to.x, y: from.y }, to];
  }
  return [from, { x: from.x, y: to.y }, to];
}

/**
 * Expand a route-tree decision into typed edits + resolved geometry + metrics.
 *
 * Returns a conflict (no edits) when the chosen shape cannot be laid out, or
 * when required endpoints are missing. Never falls back to another shape.
 */
export function expandRouteTree(
  decision: RouteTreeDecision,
  input: ExpansionInput,
): RouteTreeExpansion {
  if (!SHAPES.has(decision.shape)) {
    return conflictOnly(
      "UNKNOWN_SHAPE",
      `Unknown route-tree shape: ${decision.shape as string}`,
    );
  }
  resetIdCounter();
  const prefix = `${decision.netId}`;

  const missing = decision.endpointGroups
    .flatMap((group) => group.endpointIds)
    .filter((id) => !input.endpoints.has(id));
  if (missing.length > 0) {
    return conflictOnly(
      "MISSING_ENDPOINT",
      `Decision references endpoints not present in the input: ${missing.join(", ")}`,
      missing,
    );
  }

  switch (decision.shape) {
    case "direct":
      return expandDirect(decision, input, prefix);
    case "local-branch-tree":
      return expandLocalBranchTree(decision, input, prefix);
    case "shared-trunk":
      return expandSharedTrunk(decision, input, prefix);
    case "labeled-islands":
      return expandLabeledIslands(decision, input, prefix);
    case "ordered-bus":
      return expandOrderedBus(decision, input, prefix);
    default:
      return conflictOnly(
        "UNSUPPORTED_SHAPE",
        `Shape ${(decision as { shape: string }).shape} is recognized but not yet implemented`,
      );
  }
}

function expandDirect(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
): RouteTreeExpansion {
  // One route per group, endpoint-to-endpoint via route_orthogonal. No
  // junctions. Best for 2-endpoint nets or already-aligned groups.
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteTreeExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];
  for (const group of decision.endpointGroups) {
    if (group.endpointIds.length !== 2) {
      conflicts.push({
        code: "SHAPE_MISMATCH",
        message: `direct shape requires exactly 2 endpoints per group; group ${group.id} has ${group.endpointIds.length}`,
        objectIds: [group.id],
      });
      continue;
    }
    const from = endpointOf(input, group.endpointIds[0]!);
    const to = endpointOf(input, group.endpointIds[1]!);
    if (!from || !to) continue;
    const routeId = stableId(`${prefix}-route`);
    edits.push(
      routeOrthogonalEdit(routeId, decision.netId, from.endpoint, to.endpoint),
    );
    resolvedGeometry.push({ routeId, points: [from.point, to.point] });
    assumptions.push(
      `group ${group.id}: direct route_orthogonal between ${label(from.endpoint)} and ${label(to.endpoint)}`,
    );
  }
  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

function expandLocalBranchTree(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
): RouteTreeExpansion {
  // A single branch junction per group; each endpoint escapes to the junction,
  // and groups attach via a short route. Junction placed at the snapped median
  // of the group's endpoints.
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteTreeExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];
  const groupJunctions = new Map<string, string>();
  for (const group of decision.endpointGroups) {
    if (group.endpointIds.length < 2) {
      conflicts.push({
        code: "SHAPE_MISMATCH",
        message: `local-branch-tree needs >=2 endpoints per group; group ${group.id} has ${group.endpointIds.length}`,
        objectIds: [group.id],
      });
      continue;
    }
    const junctionId = stableId(`${prefix}-j-${group.id}`);
    const junctionPoint = snappedMedian(input, group.endpointIds);
    edits.push(addJunctionEdit(junctionId, decision.netId, junctionPoint));
    groupJunctions.set(group.id, junctionId);
    for (const endpointId of group.endpointIds) {
      const endpoint = endpointOf(input, endpointId);
      if (!endpoint) continue;
      const routeId = stableId(`${prefix}-esc`);
      edits.push(
        routeOrthogonalEdit(routeId, decision.netId, endpoint.endpoint, {
          kind: "junction",
          junctionId,
        }),
      );
      resolvedGeometry.push({
        routeId,
        points: [endpoint.point, junctionPoint],
      });
    }
    assumptions.push(
      `group ${group.id}: branch junction at (${junctionPoint.x},${junctionPoint.y})`,
    );
  }
  // Inter-group attachment: connect group junctions per attachTo.
  appendGroupLinks(
    decision,
    input,
    prefix,
    groupJunctions,
    edits,
    resolvedGeometry,
    assumptions,
  );
  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

function expandSharedTrunk(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
): RouteTreeExpansion {
  // One trunk route spanning the leftmost-to-rightmost group anchor; each
  // endpoint escapes to the nearest trunk point. Requires a clear horizontal
  // or vertical corridor; if the corridor intersects an instance, that is a
  // conflict (not a reroute).
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteTreeExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];
  const allPoints = allEndpointPoints(decision, input);
  if (allPoints.length < 2) {
    return conflictOnly(
      "SHAPE_MISMATCH",
      "shared-trunk needs at least 2 endpoints",
    );
  }
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const trunkY = snap(
    allPoints.reduce((sum, point) => sum + point.y, 0) / allPoints.length,
  );
  // Trunk corridor must not cross an instance silhouette.
  const corridorHits = input.instanceBoxes.filter(
    (box) =>
      box.min.y <= trunkY &&
      box.max.y >= trunkY &&
      box.max.x >= minX &&
      box.min.x <= maxX,
  );
  if (corridorHits.length > 0) {
    conflicts.push({
      code: "TRUNK_CORRIDOR_BLOCKED",
      message: `Trunk at y=${trunkY} crosses instance silhouettes: ${corridorHits.map((box) => box.instanceId).join(", ")}`,
      objectIds: corridorHits.map((box) => box.instanceId),
    });
  }
  // Trunk as a route between the two extreme escape points.
  const leftId = stableId(`${prefix}-trk-l`);
  const rightId = stableId(`${prefix}-trk-r`);
  edits.push(
    addJunctionEdit(leftId, decision.netId, { x: snap(minX), y: trunkY }),
  );
  edits.push(
    addJunctionEdit(rightId, decision.netId, { x: snap(maxX), y: trunkY }),
  );
  const trunkRouteId = stableId(`${prefix}-trk`);
  edits.push(
    setRouteEdit(
      trunkRouteId,
      decision.netId,
      { kind: "junction", junctionId: leftId },
      { kind: "junction", junctionId: rightId },
      [],
      ["trunk" as SegmentMode],
    ),
  );
  resolvedGeometry.push({
    routeId: trunkRouteId,
    points: [
      { x: snap(minX), y: trunkY },
      { x: snap(maxX), y: trunkY },
    ],
  });
  assumptions.push(
    `shared trunk at y=${trunkY} from x=${snap(minX)} to x=${snap(maxX)}`,
  );
  for (const group of decision.endpointGroups) {
    for (const endpointId of group.endpointIds) {
      const endpoint = endpointOf(input, endpointId);
      if (!endpoint) continue;
      const tapX = snap(endpoint.point.x);
      const tapId = stableId(`${prefix}-tap`);
      edits.push(
        addJunctionEdit(tapId, decision.netId, { x: tapX, y: trunkY }),
      );
      const routeId = stableId(`${prefix}-esc`);
      edits.push(
        routeOrthogonalEdit(routeId, decision.netId, endpoint.endpoint, {
          kind: "junction",
          junctionId: tapId,
        }),
      );
      resolvedGeometry.push({
        routeId,
        points: [endpoint.point, { x: tapX, y: trunkY }],
      });
    }
  }
  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

function expandLabeledIslands(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
): RouteTreeExpansion {
  // No routes between islands; each group forms a local branch tree and the
  // shared connectivity is expressed by the Net name, not drawn wire. The
  // caller must ensure the Net label is visible at each island.
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteTreeExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];
  for (const group of decision.endpointGroups) {
    if (group.endpointIds.length < 2) continue;
    const junctionId = stableId(`${prefix}-j-${group.id}`);
    const junctionPoint = snappedMedian(input, group.endpointIds);
    edits.push(addJunctionEdit(junctionId, decision.netId, junctionPoint));
    for (const endpointId of group.endpointIds) {
      const endpoint = endpointOf(input, endpointId);
      if (!endpoint) continue;
      const routeId = stableId(`${prefix}-esc`);
      edits.push(
        routeOrthogonalEdit(routeId, decision.netId, endpoint.endpoint, {
          kind: "junction",
          junctionId,
        }),
      );
      resolvedGeometry.push({
        routeId,
        points: [endpoint.point, junctionPoint],
      });
    }
    assumptions.push(
      `group ${group.id}: labeled island at (${junctionPoint.x},${junctionPoint.y}); relies on Net label for cross-island connectivity`,
    );
  }
  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

function expandOrderedBus(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
): RouteTreeExpansion {
  // Ordered-bus: endpoints attach to a vertical (or horizontal) trunk in a
  // stable order. Same corridor constraint as shared-trunk.
  const allPoints = allEndpointPoints(decision, input);
  if (allPoints.length < 2) {
    return conflictOnly(
      "SHAPE_MISMATCH",
      "ordered-bus needs at least 2 endpoints",
    );
  }
  const edits: SchematicEdit[] = [];
  const resolvedGeometry: RouteTreeExpansion["resolvedGeometry"] = [];
  const assumptions: string[] = [];
  const conflicts: ExpansionConflict[] = [];
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const trunkX = snap(
    allPoints.reduce((sum, point) => sum + point.x, 0) / allPoints.length,
  );
  const corridorHits = input.instanceBoxes.filter(
    (box) =>
      box.min.x <= trunkX &&
      box.max.x >= trunkX &&
      box.max.y >= minY &&
      box.min.y <= maxY,
  );
  if (corridorHits.length > 0) {
    conflicts.push({
      code: "TRUNK_CORRIDOR_BLOCKED",
      message: `Bus at x=${trunkX} crosses instance silhouettes: ${corridorHits.map((box) => box.instanceId).join(", ")}`,
      objectIds: corridorHits.map((box) => box.instanceId),
    });
  }
  const ordered = [...decision.endpointGroups]
    .flatMap((group) => group.endpointIds)
    .map((id) => endpointOf(input, id)!)
    .sort((a, b) => a.point.y - b.point.y);
  const topId = stableId(`${prefix}-bus-t`);
  const bottomId = stableId(`${prefix}-bus-b`);
  edits.push(
    addJunctionEdit(topId, decision.netId, { x: trunkX, y: snap(minY) }),
  );
  edits.push(
    addJunctionEdit(bottomId, decision.netId, { x: trunkX, y: snap(maxY) }),
  );
  const busRouteId = stableId(`${prefix}-bus`);
  edits.push(
    setRouteEdit(
      busRouteId,
      decision.netId,
      { kind: "junction", junctionId: topId },
      { kind: "junction", junctionId: bottomId },
      [],
      ["trunk" as SegmentMode],
    ),
  );
  resolvedGeometry.push({
    routeId: busRouteId,
    points: [
      { x: trunkX, y: snap(minY) },
      { x: trunkX, y: snap(maxY) },
    ],
  });
  assumptions.push(`ordered bus at x=${trunkX} ordered top-to-bottom`);
  for (const endpoint of ordered) {
    const tapY = snap(endpoint.point.y);
    const tapId = stableId(`${prefix}-tap`);
    edits.push(addJunctionEdit(tapId, decision.netId, { x: trunkX, y: tapY }));
    const routeId = stableId(`${prefix}-esc`);
    edits.push(
      routeOrthogonalEdit(routeId, decision.netId, endpoint.endpoint, {
        kind: "junction",
        junctionId: tapId,
      }),
    );
    resolvedGeometry.push({
      routeId,
      points: [endpoint.point, { x: trunkX, y: tapY }],
    });
  }
  return assemble(edits, resolvedGeometry, assumptions, conflicts);
}

// --- helpers ---

function endpointOf(
  input: ExpansionInput,
  id: string,
): ResolvedEndpoint | undefined {
  return input.endpoints.get(id);
}

function allEndpointPoints(
  decision: RouteTreeDecision,
  input: ExpansionInput,
): Point[] {
  return decision.endpointGroups
    .flatMap((group) => group.endpointIds)
    .map((id) => input.endpoints.get(id)?.point)
    .filter((point): point is Point => point !== undefined);
}

function snappedMedian(input: ExpansionInput, endpointIds: string[]): Point {
  const points = endpointIds.map((id) => endpointOf(input, id)!.point);
  const medianX =
    points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const medianY =
    points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return { x: snap(medianX), y: snap(medianY) };
}

function appendGroupLinks(
  decision: RouteTreeDecision,
  input: ExpansionInput,
  prefix: string,
  groupJunctions: Map<string, string>,
  edits: SchematicEdit[],
  resolvedGeometry: RouteTreeExpansion["resolvedGeometry"],
  assumptions: string[],
): void {
  // Track undirected pairs already linked so g1->g2 and g2->g1 do not emit two
  // duplicate routes between the same junctions.
  const linkedPairs = new Set<string>();
  for (const group of decision.endpointGroups) {
    const fromId = groupJunctions.get(group.id);
    if (!fromId) continue;
    const target = groupJunctions.get(group.attachTo);
    if (!target) continue;
    if (fromId === target) continue;
    const pairKey = [fromId, target]
      .sort((a, b) => a.localeCompare(b, "en"))
      .join("|");
    if (linkedPairs.has(pairKey)) continue;
    linkedPairs.add(pairKey);
    const routeId = stableId(`${prefix}-link`);
    edits.push(
      setRouteEdit(
        routeId,
        decision.netId,
        { kind: "junction", junctionId: fromId },
        { kind: "junction", junctionId: target },
        [],
        ["auto" as SegmentMode, "auto" as SegmentMode],
      ),
    );
    const fromPoint = junctionPosition(edits, fromId);
    const toPoint = junctionPosition(edits, target);
    if (fromPoint && toPoint) {
      resolvedGeometry.push({
        routeId,
        points: orthoLShape(fromPoint, toPoint, true),
      });
    }
    assumptions.push(`link group ${group.id} -> ${group.attachTo}`);
  }
}

function junctionPosition(
  edits: SchematicEdit[],
  junctionId: string,
): Point | undefined {
  const add = edits.find(
    (edit): edit is Extract<SchematicEdit, { kind: "add_junction" }> =>
      edit.kind === "add_junction" && edit.junctionId === junctionId,
  );
  return add?.position;
}

function label(endpoint: RouteEndpoint): string {
  switch (endpoint.kind) {
    case "terminal":
      return `${endpoint.instanceId}.${endpoint.pinName}`;
    case "port":
      return endpoint.portId;
    case "junction":
      return endpoint.junctionId;
  }
}

function routeOrthogonalEdit(
  routeId: string,
  netId: string,
  from: RouteEndpoint,
  to: RouteEndpoint,
): SchematicEdit {
  return { kind: "route_orthogonal", routeId, netId, from, to };
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

function addJunctionEdit(
  junctionId: string,
  netId: string,
  position: Point,
): SchematicEdit {
  return { kind: "add_junction", junctionId, netId, position };
}

function assemble(
  edits: SchematicEdit[],
  resolvedGeometry: RouteTreeExpansion["resolvedGeometry"],
  assumptions: string[],
  conflicts: ExpansionConflict[],
): RouteTreeExpansion {
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
  }
  return ids;
}

function computeMetrics(
  edits: SchematicEdit[],
  resolvedGeometry: RouteTreeExpansion["resolvedGeometry"],
): RouteTreeExpansion["metrics"] {
  let totalRouteLength = 0;
  let bendCount = 0;
  for (const route of resolvedGeometry) {
    for (let index = 1; index < route.points.length; index++) {
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

function conflictOnly(
  code: string,
  message: string,
  objectIds?: string[],
): RouteTreeExpansion {
  return {
    edits: [],
    generatedObjectIds: [],
    resolvedGeometry: [],
    metrics: {
      routeCount: 0,
      junctionCount: 0,
      totalRouteLength: 0,
      bendCount: 0,
    },
    assumptions: [],
    conflicts: [{ code, message, ...(objectIds ? { objectIds } : {}) }],
  };
}
