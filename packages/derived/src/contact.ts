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
 * Only endpoint coincidence participates. Route waypoints and geometric
 * crossings are deliberately excluded, so deriving contacts cannot turn a
 * crossing into a connection. This is the shared evidence used by visible
 * connectivity, junction rendering, and diagnostics.
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

function routeEndpointDirection(
  geometry: ResolvedDocumentRoutingGeometry,
  routeId: string,
  endpoint: "from" | "to",
): Point | null {
  const centerline = geometry.routes.get(routeId)?.centerline;
  if (!centerline || centerline.length < 2) return null;
  const at = endpoint === "from" ? centerline[0]! : centerline.at(-1)!;
  const adjacent = endpoint === "from" ? centerline[1]! : centerline.at(-2)!;
  const direction = {
    x: Math.sign(adjacent.x - at.x),
    y: Math.sign(adjacent.y - at.y),
  };
  return direction.x === 0 && direction.y === 0 ? null : direction;
}

function contactIncidents(
  document: SchematicDocument,
  resolver: SymbolResolver,
  endpoints: readonly RouteEndpoint[],
  geometry: ResolvedDocumentRoutingGeometry,
): ContactIncident[] {
  const incidents: ContactIncident[] = [];
  const endpointKeys = new Set(endpoints.map(endpointKey));
  for (const route of document.routes) {
    for (const side of ["from", "to"] as const) {
      const endpoint = route[side];
      if (!endpointKeys.has(endpointKey(endpoint))) continue;
      const direction = routeEndpointDirection(geometry, route.id, side);
      if (direction) {
        incidents.push({ kind: "route", objectId: route.id, direction });
      }
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
