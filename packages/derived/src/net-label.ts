import type {
  Annotation,
  Point,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { endpointKey, netEndpoints, resolveEndpointPoint } from "./endpoint.js";
import { routePolyline } from "./routes.js";

export interface ResolvedNetLabelBinding {
  annotationId: string;
  netId: string;
  routeId?: string;
  segmentIndex?: number;
  endpoint: RouteEndpoint;
}

function squaredDistanceToSegment(
  point: Point,
  from: Point,
  to: Point,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared,
          ),
        );
  const x = from.x + dx * t;
  const y = from.y + dy * t;
  return (point.x - x) ** 2 + (point.y - y) ** 2;
}

/**
 * Resolves the single accepted electrical meaning of a Net Label.
 *
 * `attachedObjectId` is a Net id. The annotation position chooses the closest
 * routed component of that Net for virtual-connectivity purposes; it never
 * changes the persisted binding into a Route or Junction id.
 */
export function resolveNetLabelBinding(
  document: SchematicDocument,
  resolver: SymbolResolver,
  annotation: Annotation,
): ResolvedNetLabelBinding | null {
  if (
    annotation.kind !== "net-label" ||
    !annotation.attachedObjectId ||
    !document.nets.some((net) => net.id === annotation.attachedObjectId)
  ) {
    return null;
  }
  const netId = annotation.attachedObjectId;
  const routeCandidates = document.routes
    .filter((route) => route.netId === netId)
    .flatMap((route) => {
      const polyline = routePolyline(document, resolver, route);
      if (!polyline) return [];
      return polyline.points.slice(0, -1).map((from, segmentIndex) => ({
        distance: squaredDistanceToSegment(
          annotation.position,
          from,
          polyline.points[segmentIndex + 1]!,
        ),
        endpoint: route.from,
        routeId: route.id,
        segmentIndex,
      }));
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.routeId.localeCompare(right.routeId, "en") ||
        left.segmentIndex - right.segmentIndex,
    );
  const route = routeCandidates[0];
  if (route) {
    return {
      annotationId: annotation.id,
      netId,
      routeId: route.routeId,
      segmentIndex: route.segmentIndex,
      endpoint: route.endpoint,
    };
  }

  const net = document.nets.find((candidate) => candidate.id === netId)!;
  const endpoint = netEndpoints(document, net)
    .flatMap((candidate) => {
      const position = resolveEndpointPoint(document, resolver, candidate);
      return position
        ? [
            {
              endpoint: candidate,
              distance:
                (annotation.position.x - position.x) ** 2 +
                (annotation.position.y - position.y) ** 2,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        endpointKey(left.endpoint).localeCompare(
          endpointKey(right.endpoint),
          "en",
        ),
    )[0]?.endpoint;
  return endpoint ? { annotationId: annotation.id, netId, endpoint } : null;
}

export function resolveNetLabelBindings(
  document: SchematicDocument,
  resolver: SymbolResolver,
  netId: string,
): ResolvedNetLabelBinding[] {
  return document.annotations
    .flatMap((annotation) => {
      const binding = resolveNetLabelBinding(document, resolver, annotation);
      return binding?.netId === netId ? [binding] : [];
    })
    .sort((left, right) =>
      left.annotationId.localeCompare(right.annotationId, "en"),
    );
}
