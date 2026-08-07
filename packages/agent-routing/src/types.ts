// Agent-local route-tree decision and expansion types.
//
// Per ADR 0008, these types live ONLY in @icm/agent-routing. They MUST NOT
// appear in @icm/agent-adapter request/response schemas, MUST NOT appear in
// @icm/model project schema, MUST NOT be persisted into project.icproj.json,
// and MUST NOT survive across sessions. They carry no select/query/region
// capability; their input is a derived slice of an existing Snapshot.

import type { Point, RouteEndpoint } from "@icm/model";
import type { SchematicEdit } from "@icm/edit-engine";

/**
 * The finite, explicit set of routing-tree shapes the v1 expander accepts.
 * There is no `auto` or `best` shape; the caller must choose explicitly.
 */
export type RouteTreeShape =
  | "direct"
  | "local-branch-tree"
  | "shared-trunk"
  | "labeled-islands"
  | "ordered-bus";

/**
 * A resolved endpoint the expander reasons over. The caller supplies endpoint
 * IDs and the expander fills page coordinates and outward direction from the
 * Snapshot-derived input. `outward` is null for ports/junctions (no inherent
 * escape direction).
 */
export interface ResolvedEndpoint {
  id: string;
  endpoint: RouteEndpoint;
  point: Point;
  /** Outward escape unit vector; null for non-terminal endpoints. */
  outward: Point | null;
}

/**
 * A group of endpoints that share a branch in the tree. `attachTo` names the
 * anchor the group connects to: either another group id, a trunk anchor id,
 * or the special `"net"` to attach directly to the net's named label.
 */
export interface EndpointGroup {
  id: string;
  endpointIds: string[];
  attachTo: string;
}

export type AnchorSpec =
  | {
      kind: "between-groups";
      id: string;
      groupA: string;
      groupB: string;
      axis: "horizontal" | "vertical";
    }
  | {
      kind: "outside-group";
      id: string;
      group: string;
      side: "top" | "right" | "bottom" | "left";
    };

export interface EndpointException {
  endpointId: string;
  reason: string;
  preferredSide?: "top" | "right" | "bottom" | "left";
}

/**
 * Agent-local decision for one Net's routing tree. Carries topology only —
 * no coordinates, waypoints, or segmentModes. The expander resolves geometry.
 */
export interface RouteTreeDecision {
  documentId: string;
  revision: number;
  netId: string;
  shape: RouteTreeShape;
  endpointGroups: EndpointGroup[];
  anchors?: AnchorSpec[];
  exceptions?: EndpointException[];
}

export interface ExpansionConflict {
  code: string;
  message: string;
  objectIds?: string[];
}

export interface ResolvedRouteGeometry {
  routeId: string;
  points: Point[];
}

export interface ExpansionMetrics {
  routeCount: number;
  junctionCount: number;
  totalRouteLength: number;
  bendCount: number;
}

/**
 * The expander output: typed edits ready for `transact`, the resolved geometry
 * it computed, metrics, assumptions it made, and conflicts it could not
 * resolve by geometry alone. The caller resolves conflicts by changing the
 * decision or placement — never by the expander silently switching shapes.
 */
export interface RouteTreeExpansion {
  edits: SchematicEdit[];
  generatedObjectIds: string[];
  resolvedGeometry: ResolvedRouteGeometry[];
  metrics: ExpansionMetrics;
  assumptions: string[];
  conflicts: ExpansionConflict[];
}
