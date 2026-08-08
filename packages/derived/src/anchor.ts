import type { Point, SchematicDocument, VisualAnchor } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { routeAttachmentPlacement, routePolyline } from "./routes.js";

// ADR 0010 general VisualAnchor resolver. It generalizes the existing
// routeAttachmentPlacement() (current-marker-specific) to the free | object |
// route union. Anchor resolution reads derived geometry only; it never mutates
// a Route or Net. An unresolved anchor returns the last-known fallbackPosition
// and a diagnostic; it never silently re-attaches to another conductor.

export interface ResolvedAnchor {
  position: Point;
  rotation: 0 | 90 | 180 | 270;
  resolved: boolean;
  /**
   * Present only when the anchor could not be resolved (deleted Route/object,
   * removed segment, non-orthogonal segment). Warning state is derived here,
   * never persisted as a boolean.
   */
  diagnostic?: AnchorDiagnostic;
}

export type AnchorDiagnosticCode =
  | "anchor-target-missing"
  | "DRAFTING_ROUTE_SEGMENT_INVALID";

export interface AnchorDiagnostic {
  code: AnchorDiagnosticCode;
  message: string;
  objectId?: string;
}

/**
 * Resolve a VisualAnchor against a Document. A `route` anchor reuses the
 * existing routeAttachmentPlacement math so its result is identical to the
 * legacy current-marker path; an `object` anchor resolves to the target's
 * placement plus localOffset; a `free` anchor is its own position.
 */
export function resolveVisualAnchor(
  document: SchematicDocument,
  resolver: SymbolResolver,
  anchor: VisualAnchor,
): ResolvedAnchor {
  switch (anchor.kind) {
    case "free":
      return { position: anchor.position, rotation: 0, resolved: true };
    case "object":
      return resolveObjectAnchor(document, anchor);
    case "route":
      return resolveRouteAnchor(document, resolver, anchor);
  }
}

function resolveObjectAnchor(
  document: SchematicDocument,
  anchor: Extract<VisualAnchor, { kind: "object" }>,
): ResolvedAnchor {
  const target = findObjectPlacement(document, anchor.objectId);
  if (!target) {
    return {
      position: anchor.fallbackPosition,
      rotation: 0,
      resolved: false,
      diagnostic: {
        code: "anchor-target-missing",
        message: `Anchor target ${anchor.objectId} is missing; using fallback position.`,
        objectId: anchor.objectId,
      },
    };
  }
  return {
    position: {
      x: target.x + anchor.localOffset.x,
      y: target.y + anchor.localOffset.y,
    },
    rotation: 0,
    resolved: true,
  };
}

function resolveRouteAnchor(
  document: SchematicDocument,
  resolver: SymbolResolver,
  anchor: Extract<VisualAnchor, { kind: "route" }>,
): ResolvedAnchor {
  const route = document.routes.find(
    (candidate) => candidate.id === anchor.routeId,
  );
  if (!route) {
    return unresolvedRoute(
      anchor,
      "DRAFTING_ANCHOR_TARGET_MISSING",
      `Route ${anchor.routeId} is missing; using fallback position.`,
    );
  }
  const polyline = routePolyline(document, resolver, route);
  if (!polyline) {
    return unresolvedRoute(
      anchor,
      "DRAFTING_ANCHOR_TARGET_MISSING",
      `Route ${anchor.routeId} has no resolvable polyline; using fallback position.`,
    );
  }
  const placement = routeAttachmentPlacement(polyline, {
    routeId: anchor.routeId,
    segmentIndex: anchor.segmentIndex,
    t: anchor.t,
    normalOffset: anchor.normalOffset,
    direction: anchor.direction,
  });
  if (!placement) {
    // P2: a valid route whose segment is gone/out-of-range is a distinct,
    // actionable failure (re-select the segment), not a missing target.
    return unresolvedRoute(
      anchor,
      "DRAFTING_ROUTE_SEGMENT_INVALID",
      `Route ${anchor.routeId} segment ${anchor.segmentIndex} is no longer valid; using fallback position.`,
    );
  }
  return {
    position:
      anchor.orientation === "horizontal"
        ? placement.position
        : placement.labelPosition,
    rotation: anchor.orientation === "horizontal" ? 0 : placement.rotation,
    resolved: true,
  };
}

function unresolvedRoute(
  anchor: Extract<VisualAnchor, { kind: "route" }>,
  code: "DRAFTING_ANCHOR_TARGET_MISSING" | "DRAFTING_ROUTE_SEGMENT_INVALID",
  message: string,
): ResolvedAnchor {
  return {
    position: anchor.fallbackPosition,
    rotation: 0,
    resolved: false,
    diagnostic: {
      code: code === "DRAFTING_ROUTE_SEGMENT_INVALID"
        ? "DRAFTING_ROUTE_SEGMENT_INVALID"
        : "anchor-target-missing",
      message,
      objectId: anchor.routeId,
    },
  };
}

/**
 * Find the placement Point of an attachable object: an Instance, Port, or
 * Junction. A DraftingObject is intentionally not a valid V1 anchor target
 * (ADR 0010: no drafting-to-drafting attachment).
 */
function findObjectPlacement(
  document: SchematicDocument,
  objectId: string,
): Point | null {
  const instance = document.instances.find(
    (candidate) => candidate.id === objectId,
  );
  if (instance?.placement) return instance.placement.position;
  const port = document.ports.find((candidate) => candidate.id === objectId);
  if (port) return port.position;
  const junction = document.junctions.find(
    (candidate) => candidate.id === objectId,
  );
  if (junction) return junction.position;
  return null;
}
