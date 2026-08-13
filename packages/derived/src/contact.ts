import { deriveStableId } from "@icm/model";
import type { Net, Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  endpointKey,
  isVisibleEndpoint,
  netEndpoints,
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "./endpoint.js";
import {
  resolveDocumentRoutingGeometry,
  type ResolvedDocumentRoutingGeometry,
} from "./resolved-route-geometry.js";

export interface ContactIncident {
  kind: "route" | "terminal";
  objectId: string;
  direction: Point;
}

/**
 * One derived electrical contact between explicit graph nodes on the same Net.
 *
 * Contact locations come only from explicit same-Net endpoints. Once such a
 * location exists, same-Net Route geometry through that point contributes its
 * visible conductor arms. A free geometric crossing cannot create a contact;
 * a terminal or Junction already owned by the Net must anchor it. This is the
 * shared evidence used by visible connectivity, junction rendering, and
 * diagnostics.
 */
export interface CoincidentContact {
  id: string;
  netId: string;
  point: Point;
  endpoints: readonly RouteEndpoint[];
  incidents: readonly ContactIncident[];
  branchDirections: readonly Point[];
}

export interface DocumentContactEvidence {
  contacts: readonly CoincidentContact[];
  byEndpointKey: ReadonlyMap<string, CoincidentContact>;
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function directionKey(direction: Point): string {
  return `${Math.sign(direction.x)},${Math.sign(direction.y)}`;
}

function inverseAxisDirection(direction: Point): Point {
  return {
    x: direction.x === 0 ? 0 : -Math.sign(direction.x),
    y: direction.y === 0 ? 0 : -Math.sign(direction.y),
  };
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  const cross =
    (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x);
  if (cross !== 0) return false;
  return (
    point.x >= Math.min(from.x, to.x) &&
    point.x <= Math.max(from.x, to.x) &&
    point.y >= Math.min(from.y, to.y) &&
    point.y <= Math.max(from.y, to.y)
  );
}

/** Visible conductor arms of one resolved Route at an electrical contact. */
function routeDirectionsAtPoint(
  centerline: readonly Point[],
  point: Point,
): Point[] {
  const directions = new Map<string, Point>();
  for (let index = 0; index < centerline.length - 1; index += 1) {
    const from = centerline[index]!;
    const to = centerline[index + 1]!;
    if (samePoint(from, to) || !pointOnSegment(point, from, to)) continue;
    for (const candidate of [from, to]) {
      if (samePoint(candidate, point)) continue;
      const direction = {
        x: Math.sign(candidate.x - point.x),
        y: Math.sign(candidate.y - point.y),
      };
      directions.set(directionKey(direction), direction);
    }
  }
  return [...directions.values()];
}

function contactIncidents(
  document: SchematicDocument,
  resolver: SymbolResolver,
  netId: string,
  point: Point,
  endpoints: readonly RouteEndpoint[],
  geometry: ResolvedDocumentRoutingGeometry,
): ContactIncident[] {
  const incidents: ContactIncident[] = [];
  for (const route of document.routes) {
    if (route.netId !== netId) continue;
    const centerline = geometry.routes.get(route.id)?.centerline;
    if (!centerline) continue;
    for (const direction of routeDirectionsAtPoint(centerline, point)) {
      incidents.push({ kind: "route", objectId: route.id, direction });
    }
  }
  for (const endpoint of endpoints) {
    if (endpoint.kind !== "terminal") continue;
    const outward = resolveEndpointOutwardDirection(
      document,
      resolver,
      endpoint,
    );
    if (outward) {
      incidents.push({
        kind: "terminal",
        objectId: endpoint.instanceId,
        direction: inverseAxisDirection(outward),
      });
    }
  }
  return incidents.sort(
    (left, right) =>
      directionKey(left.direction).localeCompare(
        directionKey(right.direction),
        "en",
      ) ||
      left.kind.localeCompare(right.kind, "en") ||
      left.objectId.localeCompare(right.objectId, "en"),
  );
}

function netContacts(
  document: SchematicDocument,
  resolver: SymbolResolver,
  net: Net,
  geometry: ResolvedDocumentRoutingGeometry,
): CoincidentContact[] {
  const grouped = new Map<
    string,
    Array<{ endpoint: RouteEndpoint; point: Point }>
  >();
  for (const endpoint of netEndpoints(document, net)) {
    if (!isVisibleEndpoint(document, resolver, endpoint)) continue;
    const point = resolveEndpointPoint(document, resolver, endpoint);
    if (!point) continue;
    const key = pointKey(point);
    grouped.set(key, [...(grouped.get(key) ?? []), { endpoint, point }]);
  }
  return [...grouped.values()]
    .map((entries) => {
      const endpoints = entries
        .map((entry) => entry.endpoint)
        .sort((left, right) =>
          endpointKey(left).localeCompare(endpointKey(right), "en"),
        );
      const point = entries[0]!.point;
      const incidents = contactIncidents(
        document,
        resolver,
        net.id,
        point,
        endpoints,
        geometry,
      );
      const directions = new Map<string, Point>();
      for (const incident of incidents) {
        directions.set(directionKey(incident.direction), incident.direction);
      }
      return {
        id: deriveStableId(
          "contact",
          net.id,
          pointKey(point),
          endpoints.map(endpointKey).join("|"),
        ),
        netId: net.id,
        point: { ...point },
        endpoints,
        incidents,
        branchDirections: [...directions.values()],
      };
    })
    .sort(
      (left, right) =>
        left.netId.localeCompare(right.netId, "en") ||
        left.point.x - right.point.x ||
        left.point.y - right.point.y ||
        left.id.localeCompare(right.id, "en"),
    );
}

/**
 * Whether a confirmed same-Net contact needs a visible junction dot.
 *
 * A dot communicates a branch, not mere electrical continuity. Two incident
 * arms form either a straight join or a corner and remain dotless. A terminal
 * on a Route middle/bend contributes the Route arms on both sides and therefore
 * becomes a three-way branch. Three coincident pins also require a dot even if
 * two symbol stems happen to share the same geometric direction.
 */
export function contactRequiresJunctionDot(
  contact: CoincidentContact,
): boolean {
  const terminalCount = contact.endpoints.filter(
    (endpoint) => endpoint.kind === "terminal",
  ).length;
  return terminalCount >= 3 || contact.branchDirections.length >= 3;
}

export function deriveDocumentContactEvidence(
  document: SchematicDocument,
  resolver: SymbolResolver,
  routingGeometry = resolveDocumentRoutingGeometry(document, resolver),
): DocumentContactEvidence {
  const contacts = [...document.nets]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .flatMap((net) => netContacts(document, resolver, net, routingGeometry));
  const byEndpointKey = new Map<string, CoincidentContact>();
  for (const contact of contacts) {
    for (const endpoint of contact.endpoints) {
      byEndpointKey.set(endpointKey(endpoint), contact);
    }
  }
  return { contacts, byEndpointKey };
}
