import type { RouteBranch, SchematicDocument } from "@icm/model";
import { resolveEndpointConnection } from "@icm/derived";
import type { SymbolResolver } from "@icm/symbols";

import type { EditTransaction } from "./edit-schema.js";
import {
  buildOrthogonalEscapeRoute,
  normalizeRouteGeometry,
} from "./route-geometry-edit.js";
import { resolveRouteEditPath } from "./route-operations.js";
import type { RejectEdit } from "./transaction-cell-interface.js";
import { removeConnectivityEvidenceOwnedBy } from "./transaction-connectivity.js";
import {
  routeFromEdit,
  routeIsProtected,
  validateRoute,
} from "./transaction-routing.js";
import type { RejectedTransaction } from "./transaction-result.js";

type RouteGeometryEdit = Extract<
  EditTransaction["edits"][number],
  {
    kind: "set_route_points" | "route_orthogonal" | "remove_route_geometry";
  }
>;

export interface RouteGeometryEditContext {
  draft: SchematicDocument;
  resolver: SymbolResolver | undefined;
  changedObjectIds: Set<string>;
  deferNetPrune(netId: string): void;
  reject: RejectEdit;
}

export type RouteGeometryEditOutcome =
  | { ok: true; connectivityChanged: boolean }
  | { ok: false; rejection: RejectedTransaction };

export function applyRouteGeometryEdit(
  edit: RouteGeometryEdit,
  context: RouteGeometryEditContext,
): RouteGeometryEditOutcome {
  const { draft, resolver, changedObjectIds, deferNetPrune, reject } = context;

  switch (edit.kind) {
    case "set_route_points": {
      if (!resolver) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_CONTEXT_REQUIRED",
            "Routing edits require a Symbol Resolver",
          ),
        };
      }
      const existingIndex = draft.routes.findIndex(
        (candidate) => candidate.id === edit.routeId,
      );
      const existing = draft.routes[existingIndex];
      if (existing && routeIsProtected(existing)) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${edit.routeId}`,
            [],
            [edit.routeId],
          ),
        };
      }
      const route = routeFromEdit(edit);
      if (!route.presentation && existing?.presentation) {
        route.presentation = existing.presentation;
      }
      const routeError = validateRoute(draft, route, resolver);
      if (routeError) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            routeError,
            [],
            [edit.routeId],
          ),
        };
      }
      const polyline = resolveRouteEditPath(draft, resolver, route)!;
      const normalized = normalizeRouteGeometry(
        polyline.points,
        route.segmentModes,
      );
      route.waypoints = normalized.points.slice(1, -1);
      route.segmentModes = normalized.segmentModes;
      if (existingIndex >= 0) draft.routes[existingIndex] = route;
      else draft.routes.push(route);
      changedObjectIds.add(edit.routeId);
      return { ok: true, connectivityChanged: false };
    }
    case "route_orthogonal": {
      if (!resolver) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_CONTEXT_REQUIRED",
            "Orthogonal routing requires a Symbol Resolver",
          ),
        };
      }
      const existingIndex = draft.routes.findIndex(
        (candidate) => candidate.id === edit.routeId,
      );
      const existing = draft.routes[existingIndex];
      if (existing && routeIsProtected(existing)) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${edit.routeId}`,
            [],
            [edit.routeId],
          ),
        };
      }
      const fromConnection = resolveEndpointConnection(
        draft,
        resolver,
        edit.from,
      );
      const toConnection = resolveEndpointConnection(draft, resolver, edit.to);
      if (!fromConnection || !toConnection) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Route ${edit.routeId} has an unresolved endpoint`,
            [],
            [edit.routeId],
          ),
        };
      }
      const geometry = buildOrthogonalEscapeRoute(
        fromConnection,
        toConnection,
        edit.escapeLength,
        draft.presentation.grid,
      );
      const route: RouteBranch = {
        id: edit.routeId,
        netId: edit.netId,
        from: structuredClone(edit.from),
        to: structuredClone(edit.to),
        waypoints: geometry.waypoints,
        segmentModes: geometry.segmentModes,
        ...(edit.presentation ? { presentation: edit.presentation } : {}),
      };
      if (!route.presentation && existing?.presentation) {
        route.presentation = existing.presentation;
      }
      const routeError = validateRoute(draft, route, resolver);
      if (routeError) {
        return {
          ok: false,
          rejection: reject("EDIT_PRECONDITION", routeError),
        };
      }
      if (existingIndex >= 0) draft.routes[existingIndex] = route;
      else draft.routes.push(route);
      changedObjectIds.add(edit.routeId);
      return { ok: true, connectivityChanged: false };
    }
    case "remove_route_geometry": {
      const routeIndex = draft.routes.findIndex(
        (route) => route.id === edit.routeId,
      );
      const route = draft.routes[routeIndex];
      if (!route) {
        return {
          ok: false,
          rejection: reject(
            "OBJECT_NOT_FOUND",
            `Route does not exist: ${edit.routeId}`,
          ),
        };
      }
      if (routeIsProtected(route)) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${route.id}`,
          ),
        };
      }
      const anchoredAnnotation = draft.annotations.find(
        (annotation) =>
          annotation.anchor.kind === "route" &&
          annotation.anchor.routeId === route.id,
      );
      if (anchoredAnnotation) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Remove Route annotation ${anchoredAnnotation.id} before deleting Route ${route.id}`,
            [],
            [anchoredAnnotation.id, route.id],
          ),
        };
      }
      const ownerNetIds = removeConnectivityEvidenceOwnedBy(
        draft,
        new Set([route.id]),
        changedObjectIds,
      );
      draft.routes.splice(routeIndex, 1);
      changedObjectIds.add(edit.routeId);
      for (const netId of new Set([route.netId, ...ownerNetIds])) {
        deferNetPrune(netId);
      }
      return {
        ok: true,
        connectivityChanged: ownerNetIds.length > 0,
      };
    }
  }
}
