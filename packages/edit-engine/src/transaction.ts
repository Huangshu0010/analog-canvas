import {
  AnnotationSchema,
  ConnectivityEvidenceSchema,
  JunctionSchema,
  SchematicDocumentSchema,
  deriveStableId,
} from "@icm/model";
import type { RouteBranch, SchematicDocument } from "@icm/model";
import {
  endpointKey,
  hasExplicitMosBulkRoute,
  isMosBulkRoute,
  logicalNetContractIssueKey,
  mosBulkKind,
  resolveDetachedMosBulkDefault,
  resolveDocumentLogicalNets,
  resolveEndpointConnection,
  resolveMosBulkConnection,
  validateLogicalNetContract,
} from "@icm/derived";
import { EditTransactionSchema, type EditTransaction } from "./edit-schema.js";
import {
  buildOrthogonalEscapeRoute,
  normalizeRouteGeometry,
} from "./route-geometry-edit.js";
import { resolveRouteEditPath } from "./route-operations.js";
import {
  followNetLabelsOnChangedRoutes,
  followRouteMarkersOnChangedRoutes,
  remapRouteMarkersAfterSplit,
} from "./transaction-route-annotation-follow.js";
import {
  captureNetLabelRouteAnchors,
  captureRouteMarkerAnchors,
  closestRouteMarkerAnchor,
  pointAtArcFraction,
  type NetLabelRouteAnchor,
  type RouteMarkerAnchor,
} from "./transaction-route-annotations.js";
import { splitRoute } from "./transaction-route-follow.js";
import { reconcileTransformDirectContacts } from "./transaction-direct-contact.js";
import { nextPhysicalContactOperation } from "./transaction-connectivity-normalizer.js";
import { applyCellResetEdit } from "./transaction-cell-reset.js";
import { applyCellInterfaceEdit } from "./transaction-cell-interface.js";
import { applyInstanceLifecycleEdit } from "./transaction-instance-lifecycle.js";
import { applyInstanceNetlistEdit } from "./transaction-instance-netlist.js";
import { applyInstanceTransformEdit } from "./transaction-instance-transform.js";
import { applyPresentationLayoutEdit } from "./transaction-presentation-layout.js";
import {
  type BulkDefaultIdentity,
  connectivityEvidenceNetIds,
  implicitBulkPresentation,
  mergeBaseNets,
  physicalContactObjectIdsForTransaction,
  preferredPhysicalMergeTarget,
  propagateSpiceSourceEvidenceAfterSplit,
  pruneUnreachableLocalNet,
  reconcileMaterializedMosBulkBindings,
  removeConnectivityEvidenceOwnedBy,
  removeNoConnectForEndpoint,
  retargetConnectivityEvidenceOwner,
  retargetMosBulkDefaultsAfterSplit,
  retargetOwnerEvidenceAfterSplit,
  revokeInvalidatedSupplyBulkDefaults,
  uniquePhysicalContactId,
} from "./transaction-connectivity.js";
import {
  addEndpointToNet,
  endpointOwnerNetId,
  lockedLayoutOwner,
  netEndpointGroups,
  routeFromEdit,
  routeIsProtected,
  sameResolvedRoutePoints,
  validateConnectableEndpoint,
  validateRoute,
} from "./transaction-routing.js";
import {
  gridAlignmentDiagnostics,
  isHistoryEdit,
  schemaDiagnostics,
  snapPointToDocumentGrid,
} from "./transaction-preflight.js";
import {
  rejectTransaction,
  type EditDiagnostic,
  type EditDiff,
  type EditErrorCode,
  type EditExecutionContext,
  type EditTransactionResult,
  type RejectedTransaction,
} from "./transaction-result.js";

export * from "./edit-schema.js";
export * from "./transaction-result.js";

export function executeTransaction(
  document: SchematicDocument,
  input: EditTransaction | unknown,
  context: EditExecutionContext = {},
): EditTransactionResult {
  const parsed = EditTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return rejectTransaction(
      document,
      "INVALID_TRANSACTION",
      "Transaction schema validation failed",
      schemaDiagnostics(parsed.error, "INVALID_TRANSACTION"),
    );
  }

  const transaction = parsed.data;
  if (transaction.documentId !== document.id) {
    return rejectTransaction(
      document,
      "DOCUMENT_MISMATCH",
      `Transaction targets ${transaction.documentId}, but the open Document is ${document.id}`,
    );
  }
  if (transaction.expectedRevision !== document.revision) {
    return rejectTransaction(
      document,
      "STALE_REVISION",
      `Expected revision ${transaction.expectedRevision}, actual revision ${document.revision}`,
    );
  }
  if (transaction.edits.some(isHistoryEdit)) {
    return rejectTransaction(
      document,
      "HISTORY_CONTEXT_REQUIRED",
      "Undo and redo require a Document History session",
    );
  }

  const proposedRevision = document.revision + 1;
  const draft = structuredClone(document);
  const originalNetContractIssueKeys = new Set(
    validateLogicalNetContract(document).map(logicalNetContractIssueKey),
  );
  const explicitlyAuthoredRouteIds = new Set(
    transaction.edits.flatMap((edit) =>
      edit.kind === "set_route_points" || edit.kind === "route_orthogonal"
        ? [edit.routeId]
        : [],
    ),
  );
  const changedObjectIds = new Set<string>();
  const deferredNetPruneIds = new Set<string>();
  const protectedEvidenceIds = new Set(
    transaction.edits.flatMap((edit) =>
      edit.kind === "upsert_connectivity_evidence" ? [edit.evidence.id] : [],
    ),
  );
  const deferNetPrune = (netId: string): void =>
    pruneUnreachableLocalNet(draft, netId, changedObjectIds, {
      deferInto: deferredNetPruneIds,
    });
  const resolver = context.symbolResolver;
  const originalRouteStates = new Map(
    resolver
      ? document.routes.map((route) => [
          route.id,
          {
            points:
              resolveRouteEditPath(document, resolver, route)?.points ?? null,
            error: validateRoute(document, route, resolver),
          },
        ])
      : [],
  );
  const originalNetLabelAnchors = resolver
    ? captureNetLabelRouteAnchors(document, resolver)
    : [];
  const originalRouteMarkerAnchors = resolver
    ? captureRouteMarkerAnchors(document, resolver)
    : [];
  const changedRouteIds = new Set<string>();
  let geometryChanged = false;
  let connectivityChanged = false;

  for (let editIndex = 0; editIndex < transaction.edits.length; editIndex++) {
    const edit = transaction.edits[editIndex]!;
    // rejectAt localizes a runtime rejection to this edit's position in the
    // transaction (`["edits", editIndex]`) so a caller can pinpoint which edit
    // failed without parsing the message string. objectIds are forwarded so a
    // rejection can name the offending route/instance.
    const rejectAt = (
      code: EditErrorCode,
      message: string,
      diagnostics: readonly EditDiagnostic[] = [],
      objectIds?: readonly string[],
    ): RejectedTransaction =>
      rejectTransaction(
        document,
        code,
        message,
        diagnostics,
        ["edits", editIndex],
        objectIds,
      );
    const coordinateDiagnostics = gridAlignmentDiagnostics(
      edit,
      draft.presentation.grid,
    );
    if (coordinateDiagnostics.length > 0) {
      return rejectAt(
        "EDIT_PRECONDITION",
        `Edit coordinates must align to Document grid ${draft.presentation.grid}`,
        coordinateDiagnostics,
      );
    }
    if (
      edit.kind === "align_instances" &&
      edit.coordinate !== undefined &&
      edit.coordinate % draft.presentation.grid !== 0
    ) {
      return rejectAt(
        "EDIT_PRECONDITION",
        `Alignment coordinate must align to Document grid ${draft.presentation.grid}`,
        [
          {
            code: "GRID_ALIGNMENT",
            severity: "error",
            message: `Document page coordinates must align to grid ${draft.presentation.grid}`,
            path: ["coordinate"],
          },
        ],
      );
    }
    switch (edit.kind) {
      case "noop":
      case "undo":
      case "redo":
        continue;
      case "clear_cell_drawing":
      case "reset_cell_placement":
      case "reset_cell_body": {
        const outcome = applyCellResetEdit(edit, {
          draft,
          changedObjectIds,
          deferNetPrune,
        });
        connectivityChanged ||= outcome.connectivityChanged;
        geometryChanged ||= outcome.geometryChanged;
        break;
      }
      case "add_instance":
      case "remove_instance":
      case "add_no_connect":
      case "remove_no_connect":
      case "set_instance_symbol": {
        const outcome = applyInstanceLifecycleEdit(edit, {
          draft,
          resolver,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome.rejection;
        connectivityChanged ||= outcome.connectivityChanged;
        break;
      }
      case "place_instance":
      case "unplace_instance":
      case "move_instance":
      case "rotate_instance":
      case "mirror_instance": {
        const outcome = applyInstanceTransformEdit(edit, {
          draft,
          resolver,
          explicitlyAuthoredRouteIds,
          changedObjectIds,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome.rejection;
        break;
      }
      case "patch_instance_netlist_parameters":
      case "set_instance_reference":
      case "set_instance_schematic_reference":
      case "set_instance_schematic_name":
      case "set_instance_binding":
      case "set_instance_netlist":
      case "bulk_patch_instance_netlist": {
        const outcome = applyInstanceNetlistEdit(edit, {
          draft,
          changedObjectIds,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome.rejection;
        connectivityChanged ||= outcome.connectivityChanged;
        break;
      }
      case "add_cell_terminal":
      case "update_cell_terminal":
      case "remove_cell_terminal":
      case "reorder_cell_terminals":
      case "set_cell_formal_parameters": {
        const outcome = applyCellInterfaceEdit(edit, {
          draft,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome.rejection;
        if (outcome.connectivityChanged) connectivityChanged = true;
        break;
      }
      case "set_route_points": {
        const resolver = context.symbolResolver;
        if (!resolver) {
          return rejectAt(
            "EDIT_CONTEXT_REQUIRED",
            "Routing edits require a Symbol Resolver",
          );
        }
        const existingIndex = draft.routes.findIndex(
          (candidate) => candidate.id === edit.routeId,
        );
        const existing = draft.routes[existingIndex];
        if (existing && routeIsProtected(existing)) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${edit.routeId}`,
            [],
            [edit.routeId],
          );
        }
        const route = routeFromEdit(edit);
        if (!route.presentation && existing?.presentation) {
          route.presentation = existing.presentation;
        }
        const routeError = validateRoute(draft, route, resolver);
        if (routeError) {
          return rejectAt("EDIT_PRECONDITION", routeError, [], [edit.routeId]);
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
        break;
      }
      case "route_orthogonal": {
        const resolver = context.symbolResolver;
        if (!resolver) {
          return rejectAt(
            "EDIT_CONTEXT_REQUIRED",
            "Orthogonal routing requires a Symbol Resolver",
          );
        }
        const existingIndex = draft.routes.findIndex(
          (candidate) => candidate.id === edit.routeId,
        );
        const existing = draft.routes[existingIndex];
        if (existing && routeIsProtected(existing)) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${edit.routeId}`,
            [],
            [edit.routeId],
          );
        }
        const fromConnection = resolveEndpointConnection(
          draft,
          resolver,
          edit.from,
        );
        const toConnection = resolveEndpointConnection(
          draft,
          resolver,
          edit.to,
        );
        if (!fromConnection || !toConnection) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route ${edit.routeId} has an unresolved endpoint`,
            [],
            [edit.routeId],
          );
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
          return rejectAt("EDIT_PRECONDITION", routeError);
        }
        if (existingIndex >= 0) draft.routes[existingIndex] = route;
        else draft.routes.push(route);
        changedObjectIds.add(edit.routeId);
        break;
      }
      case "add_junction": {
        if (!draft.nets.some((net) => net.id === edit.netId)) {
          if (!edit.createNet) {
            return rejectAt(
              "OBJECT_NOT_FOUND",
              `Junction net does not exist: ${edit.netId}`,
            );
          }
          draft.nets.push({
            id: edit.netId,
            terminals: [],
          });
          changedObjectIds.add(edit.netId);
        }
        if (
          draft.junctions.some((junction) => junction.id === edit.junctionId)
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Junction already exists: ${edit.junctionId}`,
          );
        }
        draft.junctions.push(
          JunctionSchema.parse({
            id: edit.junctionId,
            netId: edit.netId,
            position: edit.position,
            role: edit.role ?? "branch",
          }),
        );
        changedObjectIds.add(edit.junctionId);
        if (edit.split) {
          const resolver = context.symbolResolver;
          if (!resolver) {
            return rejectAt(
              "EDIT_CONTEXT_REQUIRED",
              "Route splitting requires a Symbol Resolver",
            );
          }
          const routeIndex = draft.routes.findIndex(
            (route) => route.id === edit.split!.routeId,
          );
          const route = draft.routes[routeIndex];
          if (!route) {
            return rejectAt(
              "OBJECT_NOT_FOUND",
              `Route does not exist: ${edit.split.routeId}`,
            );
          }
          if (route.netId !== edit.netId) {
            return rejectAt(
              "EDIT_PRECONDITION",
              "Junction and split route must belong to the same Net",
            );
          }
          if (routeIsProtected(route)) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Route contains a locked segment: ${route.id}`,
            );
          }
          const splitMarkerAnchors = captureRouteMarkerAnchors(
            draft,
            resolver,
          ).filter((anchor) => anchor.routeId === route.id);
          const split = splitRoute(
            draft,
            route,
            { kind: "junction", junctionId: edit.junctionId },
            edit.position,
            edit.split.firstRouteId,
            edit.split.secondRouteId,
            edit.split.segmentIndex,
            resolver,
          );
          if (typeof split === "string") {
            return rejectAt("EDIT_PRECONDITION", split);
          }
          draft.routes.splice(routeIndex, 1, split.first, split.second);
          for (const splitRouteCandidate of [split.first, split.second]) {
            const routeError = validateRoute(
              draft,
              splitRouteCandidate,
              resolver,
            );
            if (routeError) {
              return rejectAt("EDIT_PRECONDITION", routeError);
            }
          }
          remapRouteMarkersAfterSplit(
            draft,
            resolver,
            splitMarkerAnchors,
            [split.first.id, split.second.id],
            changedObjectIds,
          );
          changedObjectIds.add(route.id);
          changedObjectIds.add(split.first.id);
          changedObjectIds.add(split.second.id);
        }
        connectivityChanged = true;
        break;
      }
      case "attach_endpoint_to_route": {
        const resolver = context.symbolResolver;
        if (!resolver) {
          return rejectAt(
            "EDIT_CONTEXT_REQUIRED",
            "Route attachment requires a Symbol Resolver",
          );
        }
        const endpointError = validateConnectableEndpoint(
          draft,
          edit.endpoint,
          resolver,
        );
        if (endpointError) {
          return rejectAt("EDIT_PRECONDITION", endpointError);
        }
        const routeIndex = draft.routes.findIndex(
          (candidate) => candidate.id === edit.routeId,
        );
        const route = draft.routes[routeIndex];
        if (!route) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Route does not exist: ${edit.routeId}`,
          );
        }
        if (routeIsProtected(route)) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${route.id}`,
          );
        }
        const owner = endpointOwnerNetId(draft, edit.endpoint);
        if (owner && owner !== route.netId) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Endpoint belongs to ${owner}; merge it with ${route.netId} explicitly`,
          );
        }
        const endpointConnection = resolveEndpointConnection(
          draft,
          resolver,
          edit.endpoint,
        );
        if (
          !endpointConnection ||
          endpointConnection.contactPoint.x !== edit.point.x ||
          endpointConnection.contactPoint.y !== edit.point.y
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "Attached endpoint must resolve exactly at the Route contact point",
          );
        }
        const markerAnchors = captureRouteMarkerAnchors(draft, resolver).filter(
          (anchor) => anchor.routeId === route.id,
        );
        const split = splitRoute(
          draft,
          route,
          edit.endpoint,
          edit.point,
          edit.firstRouteId,
          edit.secondRouteId,
          edit.segmentIndex,
          resolver,
        );
        if (typeof split === "string") {
          return rejectAt("EDIT_PRECONDITION", split);
        }
        addEndpointToNet(draft, route.netId, edit.endpoint);
        draft.routes.splice(routeIndex, 1, split.first, split.second);
        retargetConnectivityEvidenceOwner(
          draft,
          route.id,
          split.first.id,
          changedObjectIds,
        );
        for (const candidate of [split.first, split.second]) {
          const routeError = validateRoute(draft, candidate, resolver);
          if (routeError) return rejectAt("EDIT_PRECONDITION", routeError);
        }
        remapRouteMarkersAfterSplit(
          draft,
          resolver,
          markerAnchors,
          [split.first.id, split.second.id],
          changedObjectIds,
        );
        changedObjectIds.add(route.id);
        changedObjectIds.add(split.first.id);
        changedObjectIds.add(split.second.id);
        changedObjectIds.add(route.netId);
        connectivityChanged = true;
        break;
      }
      case "remove_junction": {
        const junctionIndex = draft.junctions.findIndex(
          (junction) => junction.id === edit.junctionId,
        );
        if (junctionIndex < 0) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Junction does not exist: ${edit.junctionId}`,
          );
        }
        if (
          draft.routes.some(
            (route) =>
              (route.from.kind === "junction" &&
                route.from.junctionId === edit.junctionId) ||
              (route.to.kind === "junction" &&
                route.to.junctionId === edit.junctionId),
          )
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Junction is still used by a Route: ${edit.junctionId}`,
          );
        }
        const junction = draft.junctions[junctionIndex]!;
        const ownerNetIds = removeConnectivityEvidenceOwnedBy(
          draft,
          new Set([edit.junctionId]),
          changedObjectIds,
        );
        draft.junctions.splice(junctionIndex, 1);
        changedObjectIds.add(edit.junctionId);
        for (const netId of new Set([junction.netId, ...ownerNetIds])) {
          deferNetPrune(netId);
        }
        connectivityChanged = true;
        break;
      }
      case "move_junction": {
        const junction = draft.junctions.find(
          (candidate) => candidate.id === edit.junctionId,
        );
        if (!junction) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Junction does not exist: ${edit.junctionId}`,
          );
        }
        const incidentRoutes = draft.routes.filter(
          (route) =>
            (route.from.kind === "junction" &&
              route.from.junctionId === junction.id) ||
            (route.to.kind === "junction" &&
              route.to.junctionId === junction.id),
        );
        const routeWithoutGeometry = incidentRoutes.find(
          (route) => !explicitlyAuthoredRouteIds.has(route.id),
        );
        if (routeWithoutGeometry) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Moving Junction ${junction.id} requires explicit geometry for incident Route ${routeWithoutGeometry.id}`,
            [],
            [junction.id, routeWithoutGeometry.id],
          );
        }
        const protectedRoute = draft.routes.find(
          (route) =>
            ((route.from.kind === "junction" &&
              route.from.junctionId === junction.id) ||
              (route.to.kind === "junction" &&
                route.to.junctionId === junction.id)) &&
            routeIsProtected(route),
        );
        if (protectedRoute) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Junction is attached to protected Route ${protectedRoute.id}`,
          );
        }
        junction.position = { ...edit.position };
        changedObjectIds.add(junction.id);
        break;
      }
      case "remove_route_geometry": {
        const routeIndex = draft.routes.findIndex(
          (route) => route.id === edit.routeId,
        );
        const route = draft.routes[routeIndex];
        if (!route) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Route does not exist: ${edit.routeId}`,
          );
        }
        if (routeIsProtected(route)) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${route.id}`,
          );
        }
        const anchoredAnnotation = draft.annotations.find(
          (annotation) =>
            annotation.anchor.kind === "route" &&
            annotation.anchor.routeId === route.id,
        );
        if (anchoredAnnotation) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Remove Route annotation ${anchoredAnnotation.id} before deleting Route ${route.id}`,
            [],
            [anchoredAnnotation.id, route.id],
          );
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
        if (ownerNetIds.length > 0) connectivityChanged = true;
        break;
      }
      case "cut_connection": {
        const routeIndex = draft.routes.findIndex(
          (route) => route.id === edit.routeId,
        );
        const route = draft.routes[routeIndex];
        if (!route) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Route does not exist: ${edit.routeId}`,
          );
        }
        if (routeIsProtected(route)) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${route.id}`,
          );
        }
        const anchoredAnnotation = draft.annotations.find(
          (annotation) =>
            annotation.anchor.kind === "route" &&
            annotation.anchor.routeId === route.id,
        );
        if (anchoredAnnotation) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Remove Route annotation ${anchoredAnnotation.id} before cutting Route ${route.id}`,
            [],
            [anchoredAnnotation.id, route.id],
          );
        }
        const net = draft.nets.find(
          (candidate) => candidate.id === route.netId,
        );
        if (!net) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Route Net does not exist: ${route.netId}`,
          );
        }
        const bulkDefaultBeforeCut =
          draft.mosBulkDefaults?.nmosNetId === net.id ||
          draft.mosBulkDefaults?.pmosNetId === net.id
            ? resolveDocumentLogicalNets(draft).byBaseNetId.get(net.id)
            : undefined;
        const bulkDefaultIdentity: BulkDefaultIdentity | undefined =
          bulkDefaultBeforeCut
            ? {
                ...(bulkDefaultBeforeCut.name
                  ? { name: bulkDefaultBeforeCut.name }
                  : {}),
                ...(bulkDefaultBeforeCut.scope
                  ? { scope: bulkDefaultBeforeCut.scope }
                  : {}),
                ...(bulkDefaultBeforeCut.powerDomain === "ground" ||
                bulkDefaultBeforeCut.powerDomain === "vdd"
                  ? { powerDomain: bulkDefaultBeforeCut.powerDomain }
                  : {}),
              }
            : undefined;
        const candidateOrphanJunctionIds = new Set(
          [route.from, route.to].flatMap((endpoint) =>
            endpoint.kind === "junction" ? [endpoint.junctionId] : [],
          ),
        );
        const ownerNetIds = new Set(
          removeConnectivityEvidenceOwnedBy(
            draft,
            new Set([route.id]),
            changedObjectIds,
          ),
        );
        draft.routes.splice(routeIndex, 1);
        changedObjectIds.add(route.id);

        const referencedJunctionIds = new Set(
          draft.routes.flatMap((candidate) =>
            [candidate.from, candidate.to].flatMap((endpoint) =>
              endpoint.kind === "junction" ? [endpoint.junctionId] : [],
            ),
          ),
        );
        const preservedObjectIds = new Set([
          ...draft.annotations.flatMap((annotation) =>
            annotation.anchor.kind === "object"
              ? [annotation.anchor.objectId]
              : [],
          ),
          ...draft.layoutGroups.flatMap((group) => group.objectIds),
          ...draft.constraints.flatMap((constraint) => constraint.objectIds),
        ]);
        const removedJunctionIds = draft.junctions
          .filter(
            (junction) =>
              junction.netId === net.id &&
              candidateOrphanJunctionIds.has(junction.id) &&
              !referencedJunctionIds.has(junction.id) &&
              !preservedObjectIds.has(junction.id),
          )
          .map((junction) => junction.id);
        for (const netId of removeConnectivityEvidenceOwnedBy(
          draft,
          new Set(removedJunctionIds),
          changedObjectIds,
        )) {
          ownerNetIds.add(netId);
        }
        draft.junctions = draft.junctions.filter(
          (junction) => !removedJunctionIds.includes(junction.id),
        );
        for (const junctionId of removedJunctionIds) {
          changedObjectIds.add(junctionId);
        }

        const groups = netEndpointGroups(draft, net.id, context.symbolResolver);
        if (groups.length === 0) {
          for (const netId of new Set([net.id, ...ownerNetIds])) {
            deferNetPrune(netId);
          }
          if (!draft.nets.some((candidate) => candidate.id === net.id)) {
            if (draft.mosBulkDefaults?.nmosNetId === net.id) {
              delete draft.mosBulkDefaults.nmosNetId;
            }
            if (draft.mosBulkDefaults?.pmosNetId === net.id) {
              delete draft.mosBulkDefaults.pmosNetId;
            }
          }
          connectivityChanged = true;
          break;
        }
        if (groups.length > 1) {
          // The component containing the authored Route's `from` endpoint (or
          // `to` when `from` was an orphan Junction removed by this cut)
          // retains the original Base-Net identity and non-owner Evidence.
          // Every detached component receives a new Base Net; logical/global/
          // imported Evidence is never allowed to suppress physical splitting.
          const primaryIndex = [route.from, route.to]
            .map((endpoint) => endpointKey(endpoint))
            .map((key) => groups.findIndex((group) => group.includes(key)))
            .find((index) => index >= 0);
          if (primaryIndex !== undefined && primaryIndex > 0) {
            groups.unshift(...groups.splice(primaryIndex, 1));
          }
          const netIdByEndpoint = new Map<string, string>();
          const splitNetIds = groups
            .slice(1)
            .map((group) =>
              deriveStableId("net-split", net.id, route.id, group[0]!),
            );
          const collidingNetId = splitNetIds.find((splitNetId) =>
            draft.nets.some((candidate) => candidate.id === splitNetId),
          );
          if (collidingNetId) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Derived split Net already exists: ${collidingNetId}`,
              [],
              [collidingNetId],
            );
          }
          groups.forEach((group, index) => {
            const groupNetId =
              index === 0
                ? net.id
                : deriveStableId("net-split", net.id, route.id, group[0]!);
            for (const key of group) netIdByEndpoint.set(key, groupNetId);
          });
          for (const instance of draft.instances) {
            if (instance.mosBulkBinding?.netId !== net.id) continue;
            const bodyNetId = netIdByEndpoint.get(
              endpointKey({
                kind: "terminal",
                instanceId: instance.id,
                pinName: "B",
              }),
            );
            if (bodyNetId && bodyNetId !== net.id) {
              instance.mosBulkBinding.netId = bodyNetId;
              changedObjectIds.add(instance.id);
            }
          }
          const originalTerminals = [...net.terminals];
          const terminalsFor = (groupNetId: string) =>
            originalTerminals.filter(
              (terminal) =>
                netIdByEndpoint.get(
                  endpointKey({ kind: "terminal", ...terminal }),
                ) === groupNetId,
            );
          net.terminals = terminalsFor(net.id);
          changedObjectIds.add(net.id);
          for (const group of groups.slice(1)) {
            const groupNetId = netIdByEndpoint.get(group[0]!)!;
            draft.nets.push({
              id: groupNetId,
              terminals: terminalsFor(groupNetId),
            });
            changedObjectIds.add(groupNetId);
          }
          for (const cellTerminal of draft.netlist?.terminals ?? []) {
            if (cellTerminal.netId !== net.id) continue;
            const interfaceInstanceId = cellTerminal.interfaceInstanceIds[0];
            const groupNetId = interfaceInstanceId
              ? netIdByEndpoint.get(
                  endpointKey({
                    kind: "terminal",
                    instanceId: interfaceInstanceId,
                    pinName: "P",
                  }),
                )
              : undefined;
            if (groupNetId && groupNetId !== cellTerminal.netId) {
              cellTerminal.netId = groupNetId;
              changedObjectIds.add(cellTerminal.id);
            }
          }
          for (const junction of draft.junctions.filter(
            (candidate) => candidate.netId === net.id,
          )) {
            const groupNetId = netIdByEndpoint.get(
              endpointKey({ kind: "junction", junctionId: junction.id }),
            );
            if (groupNetId && groupNetId !== junction.netId) {
              junction.netId = groupNetId;
              changedObjectIds.add(junction.id);
            }
          }
          for (const remainingRoute of draft.routes.filter(
            (candidate) => candidate.netId === net.id,
          )) {
            const fromNetId = netIdByEndpoint.get(
              endpointKey(remainingRoute.from),
            );
            const toNetId = netIdByEndpoint.get(endpointKey(remainingRoute.to));
            if (!fromNetId || fromNetId !== toNetId) {
              return rejectAt(
                "INVALID_RESULT",
                `Cut leaves Route ${remainingRoute.id} across split Nets`,
                [],
                [remainingRoute.id],
              );
            }
            if (remainingRoute.netId !== fromNetId) {
              remainingRoute.netId = fromNetId;
              changedObjectIds.add(remainingRoute.id);
            }
          }
          retargetOwnerEvidenceAfterSplit(
            draft,
            net.id,
            netIdByEndpoint,
            changedObjectIds,
          );
          propagateSpiceSourceEvidenceAfterSplit(
            draft,
            net.id,
            [...new Set(netIdByEndpoint.values())],
            changedObjectIds,
          );
          retargetMosBulkDefaultsAfterSplit(
            draft,
            net.id,
            [...new Set(netIdByEndpoint.values())],
            bulkDefaultIdentity,
            changedObjectIds,
          );
          connectivityChanged = true;
        }
        break;
      }
      case "connect_endpoints": {
        const fromError = validateConnectableEndpoint(
          draft,
          edit.from,
          context.symbolResolver,
        );
        const toError = validateConnectableEndpoint(
          draft,
          edit.to,
          context.symbolResolver,
        );
        if (fromError || toError) {
          return rejectAt("EDIT_PRECONDITION", fromError ?? toError!);
        }
        const fromOwner = endpointOwnerNetId(draft, edit.from);
        const toOwner = endpointOwnerNetId(draft, edit.to);
        if (fromOwner && toOwner && fromOwner !== toOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Endpoints belong to different Nets; merge ${fromOwner} and ${toOwner} explicitly`,
          );
        }
        let netId = fromOwner ?? toOwner;
        if (!netId) {
          if (!edit.newNetId) {
            return rejectAt(
              "EDIT_PRECONDITION",
              "Two unconnected endpoints require newNetId",
            );
          }
          if (draft.nets.some((net) => net.id === edit.newNetId)) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Net already exists: ${edit.newNetId}`,
            );
          }
          netId = edit.newNetId;
          draft.nets.push({
            id: netId,
            terminals: [],
          });
          changedObjectIds.add(netId);
        }
        addEndpointToNet(draft, netId, edit.from);
        addEndpointToNet(draft, netId, edit.to);
        changedObjectIds.add(netId);
        connectivityChanged = true;
        break;
      }
      case "add_power_rail": {
        const horizontal =
          edit.start.y === edit.end.y && edit.start.x !== edit.end.x;
        const vertical =
          edit.start.x === edit.end.x && edit.start.y !== edit.end.y;
        if (!horizontal && !vertical) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "A power rail must be one non-zero axis-aligned segment",
          );
        }
        const ids = [
          edit.netId,
          edit.routeId,
          edit.startJunctionId,
          edit.endJunctionId,
          edit.labelId,
        ];
        if (new Set(ids).size !== ids.length) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "Power rail IDs must be distinct",
          );
        }
        const existingSupplyNet = draft.nets.find(
          (net) => net.id === edit.netId,
        );
        const existingIds = new Set([
          ...draft.instances.map((instance) => instance.id),
          ...draft.nets
            .filter((net) => net.id !== existingSupplyNet?.id)
            .map((net) => net.id),
          ...draft.routes.map((route) => route.id),
          ...draft.junctions.map((junction) => junction.id),
          ...draft.annotations.map((annotation) => annotation.id),
          ...(draft.drafting?.objects.map((object) => object.id) ?? []),
          ...draft.layoutGroups.map((group) => group.id),
          ...draft.constraints.map((constraint) => constraint.id),
          ...draft.noConnects.map((noConnect) => noConnect.id),
        ]);
        const duplicate = ids.find((id) => existingIds.has(id));
        if (duplicate) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Power rail object ID already exists: ${duplicate}`,
            [],
            [duplicate],
          );
        }
        const labelEndpoint = horizontal
          ? edit.start.x < edit.end.x
            ? edit.end
            : edit.start
          : edit.start.y < edit.end.y
            ? edit.start
            : edit.end;
        const labelJunctionId =
          labelEndpoint === edit.end
            ? edit.endJunctionId
            : edit.startJunctionId;
        if (!existingSupplyNet) {
          draft.nets.push({
            id: edit.netId,
            terminals: [],
          });
        }
        draft.junctions.push(
          JunctionSchema.parse({
            id: edit.startJunctionId,
            netId: edit.netId,
            position: edit.start,
            role: "route-anchor",
          }),
          JunctionSchema.parse({
            id: edit.endJunctionId,
            netId: edit.netId,
            position: edit.end,
            role: "route-anchor",
          }),
        );
        draft.routes.push({
          id: edit.routeId,
          netId: edit.netId,
          from: { kind: "junction", junctionId: edit.startJunctionId },
          to: { kind: "junction", junctionId: edit.endJunctionId },
          waypoints: [],
          segmentModes: ["manual"],
          presentation: "power-rail",
        });
        draft.annotations.push(
          AnnotationSchema.parse({
            id: edit.labelId,
            kind: "power-label",
            binding: { kind: "net-name", netId: edit.netId },
            netId: edit.netId,
            anchor: {
              kind: "object",
              objectId: labelJunctionId,
              localOffset: { x: 10, y: 10 },
              fallbackPosition: {
                x: labelEndpoint.x + 10,
                y: labelEndpoint.y + 10,
              },
            },
            alignment: "start",
            rotation: 0,
            locked: false,
          }),
        );
        draft.connectivityEvidence.push(
          ConnectivityEvidenceSchema.parse({
            id: deriveStableId(
              "connectivity-evidence",
              draft.id,
              "power-marker",
              edit.labelId,
              edit.netId,
            ),
            kind: "name-claim",
            netId: edit.netId,
            name: edit.netName,
            scope: edit.scope,
            powerDomain: edit.powerDomain,
            owner: { kind: "power-marker", objectId: edit.labelId },
          }),
        );
        for (const id of ids) changedObjectIds.add(id);
        connectivityChanged = true;
        break;
      }
      case "merge_nets": {
        if (edit.targetNetId === edit.sourceNetId) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "Net merge requires two different Nets",
          );
        }
        const merge = mergeBaseNets(
          draft,
          edit.targetNetId,
          edit.sourceNetId,
          changedObjectIds,
        );
        if (!merge.ok) {
          return rejectAt(merge.code, merge.message, [], merge.netIds);
        }
        connectivityChanged = true;
        break;
      }
      case "upsert_connectivity_evidence": {
        const existingIndex = draft.connectivityEvidence.findIndex(
          (evidence) => evidence.id === edit.evidence.id,
        );
        const collidingObject = [
          ...draft.instances,
          ...draft.nets,
          ...draft.routes,
          ...draft.junctions,
          ...draft.noConnects,
          ...draft.annotations,
          ...draft.layoutGroups,
          ...draft.constraints,
          ...(draft.drafting?.objects ?? []),
        ].find((object) => object.id === edit.evidence.id);
        if (collidingObject) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Connectivity evidence ID collides with another object: ${edit.evidence.id}`,
          );
        }
        const previous = draft.connectivityEvidence[existingIndex];
        const evidence = ConnectivityEvidenceSchema.parse(edit.evidence);
        if (existingIndex >= 0) {
          draft.connectivityEvidence[existingIndex] = evidence;
        } else {
          draft.connectivityEvidence.push(evidence);
        }
        if (
          evidence.kind === "name-claim" &&
          evidence.owner.kind === "net-label"
        ) {
          const annotationId = evidence.owner.annotationId;
          const annotation = draft.annotations.find(
            (candidate) => candidate.id === annotationId,
          );
          if (annotation?.formatOverride) {
            delete annotation.formatOverride;
            changedObjectIds.add(annotation.id);
          }
        }
        changedObjectIds.add(evidence.id);
        for (const netId of previous
          ? connectivityEvidenceNetIds(previous)
          : []) {
          if (!connectivityEvidenceNetIds(evidence).includes(netId)) {
            deferNetPrune(netId);
          }
        }
        connectivityChanged = true;
        break;
      }
      case "remove_connectivity_evidence": {
        const evidenceIndex = draft.connectivityEvidence.findIndex(
          (evidence) => evidence.id === edit.evidenceId,
        );
        const evidence = draft.connectivityEvidence[evidenceIndex];
        if (!evidence) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Connectivity evidence does not exist: ${edit.evidenceId}`,
          );
        }
        const affectedNetIds = connectivityEvidenceNetIds(evidence);
        draft.connectivityEvidence.splice(evidenceIndex, 1);
        changedObjectIds.add(evidence.id);
        for (const netId of affectedNetIds) {
          deferNetPrune(netId);
        }
        connectivityChanged = true;
        break;
      }
      case "set_mos_bulk_defaults": {
        if (edit.nmosNetId === undefined && edit.pmosNetId === undefined) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "At least one MOS bulk default must be supplied",
          );
        }
        for (const netId of [edit.nmosNetId, edit.pmosNetId]) {
          if (netId && !draft.nets.some((net) => net.id === netId)) {
            return rejectAt("OBJECT_NOT_FOUND", `Net does not exist: ${netId}`);
          }
        }
        const defaults = { ...(draft.mosBulkDefaults ?? {}) };
        if (edit.nmosNetId !== undefined) {
          if (edit.nmosNetId === null) delete defaults.nmosNetId;
          else defaults.nmosNetId = edit.nmosNetId;
        }
        if (edit.pmosNetId !== undefined) {
          if (edit.pmosNetId === null) delete defaults.pmosNetId;
          else defaults.pmosNetId = edit.pmosNetId;
        }
        draft.mosBulkDefaults =
          defaults.nmosNetId || defaults.pmosNetId ? defaults : undefined;
        connectivityChanged = true;
        break;
      }
      case "reconcile_mos_bulk": {
        const selected = edit.instanceIds ? new Set(edit.instanceIds) : null;
        for (const instance of draft.instances) {
          if (selected && !selected.has(instance.id)) continue;
          const kind = mosBulkKind(instance);
          if (!kind) continue;
          const configuredNetId =
            kind === "nmos"
              ? draft.mosBulkDefaults?.nmosNetId
              : draft.mosBulkDefaults?.pmosNetId;
          const configuredNet = configuredNetId
            ? draft.nets.find((net) => net.id === configuredNetId)
            : undefined;
          const connectedNet = draft.nets.find((net) =>
            net.terminals.some(
              (terminal) =>
                terminal.instanceId === instance.id && terminal.pinName === "B",
            ),
          );

          // A visible dashed body connection is user-authored and therefore
          // owns B even when it happens to land on the configured default Net.
          // Repair stale dual ownership by releasing only the policy metadata;
          // the explicit Net membership and Route geometry remain untouched.
          if (hasExplicitMosBulkRoute(draft, instance.id)) {
            if (instance.mosBulkBinding) {
              delete instance.mosBulkBinding;
              changedObjectIds.add(instance.id);
              connectivityChanged = true;
            }
            continue;
          }

          // Imported four-node MOS data already carries a real B terminal.
          // When the three-terminal presentation hides that terminal and it
          // is already on the explicitly configured default, adopt the policy
          // binding instead of leaving an order-sensitive "explicit" orphan.
          if (
            configuredNet &&
            connectedNet?.id === configuredNet.id &&
            implicitBulkPresentation(instance, resolver)
          ) {
            if (
              instance.mosBulkBinding?.origin !== "cell-default" ||
              instance.mosBulkBinding.netId !== configuredNet.id
            ) {
              instance.mosBulkBinding = {
                origin: "cell-default",
                netId: configuredNet.id,
              };
              changedObjectIds.add(instance.id);
            }
            continue;
          }

          // Older imported projects may already contain the failure this
          // invariant prevents: a hidden B-only split Net and the configured
          // default retain the same SPICE source provenance. Provenance is not
          // electrical union, but here it is unambiguous repair evidence.
          if (
            configuredNet &&
            connectedNet &&
            connectedNet.id !== configuredNet.id &&
            implicitBulkPresentation(instance, resolver) &&
            resolveDetachedMosBulkDefault(draft, instance)?.id ===
              configuredNet.id
          ) {
            connectedNet.terminals = connectedNet.terminals.filter(
              (terminal) =>
                terminal.instanceId !== instance.id || terminal.pinName !== "B",
            );
            if (
              !configuredNet.terminals.some(
                (terminal) =>
                  terminal.instanceId === instance.id &&
                  terminal.pinName === "B",
              )
            ) {
              configuredNet.terminals.push({
                instanceId: instance.id,
                pinName: "B",
              });
            }
            instance.mosBulkBinding = {
              origin: "cell-default",
              netId: configuredNet.id,
            };
            changedObjectIds.add(instance.id);
            changedObjectIds.add(connectedNet.id);
            changedObjectIds.add(configuredNet.id);
            deferNetPrune(connectedNet.id);
            connectivityChanged = true;
            continue;
          }

          const resolution = resolveMosBulkConnection(draft, instance);
          if (
            !resolution ||
            resolution.materialized ||
            resolution.status === "no-connect" ||
            resolution.status === "unresolved"
          ) {
            continue;
          }
          let target = resolution.net;
          if (!target || resolution.status !== "cell-default") continue;
          target.terminals.push({ instanceId: instance.id, pinName: "B" });
          instance.mosBulkBinding = {
            origin: "cell-default",
            netId: target.id,
          };
          changedObjectIds.add(instance.id);
          changedObjectIds.add(target.id);
          connectivityChanged = true;
        }
        break;
      }
      case "clear_mos_bulk_default": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        const binding = instance.mosBulkBinding;
        if (!binding) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `MOS ${instance.id} has no default bulk binding to override`,
          );
        }
        if (
          draft.routes.some(
            (route) =>
              isMosBulkRoute(draft, route) &&
              [route.from, route.to].some(
                (endpoint) =>
                  endpoint.kind === "terminal" &&
                  endpoint.instanceId === instance.id &&
                  endpoint.pinName === "B",
              ),
          )
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `MOS ${instance.id} already has visible bulk routing`,
          );
        }
        const net = draft.nets.find(
          (candidate) => candidate.id === binding.netId,
        );
        if (net) {
          net.terminals = net.terminals.filter(
            (terminal) =>
              terminal.instanceId !== instance.id || terminal.pinName !== "B",
          );
          changedObjectIds.add(net.id);
        }
        delete instance.mosBulkBinding;
        changedObjectIds.add(instance.id);
        connectivityChanged = true;
        break;
      }
      case "disconnect_endpoint": {
        const error = validateConnectableEndpoint(
          draft,
          edit.endpoint,
          context.symbolResolver,
        );
        if (error) {
          return rejectAt("EDIT_PRECONDITION", error);
        }
        const ownerId = endpointOwnerNetId(draft, edit.endpoint);
        if (!ownerId) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "Endpoint is not connected to a Net",
          );
        }
        if (
          draft.routes.some(
            (route) =>
              endpointKey(route.from) === endpointKey(edit.endpoint) ||
              endpointKey(route.to) === endpointKey(edit.endpoint),
          )
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            "Remove route geometry before disconnecting its endpoint",
          );
        }
        const owner = draft.nets.find((net) => net.id === ownerId)!;
        const endpoint = edit.endpoint;
        owner.terminals = owner.terminals.filter(
          (terminal) =>
            terminal.instanceId !== endpoint.instanceId ||
            terminal.pinName !== endpoint.pinName,
        );
        if (endpoint.pinName === "B") {
          const instance = draft.instances.find(
            (candidate) => candidate.id === endpoint.instanceId,
          );
          if (instance?.mosBulkBinding) {
            delete instance.mosBulkBinding;
            changedObjectIds.add(instance.id);
          }
        }
        changedObjectIds.add(owner.id);
        deferNetPrune(owner.id);
        connectivityChanged = true;
        break;
      }
      case "set_presentation_style":
      case "set_cell_symbol_presentation":
      case "upsert_schematic_annotation":
      case "remove_schematic_annotation":
      case "upsert_drafting_object":
      case "remove_drafting_object":
      case "set_layout_group":
      case "remove_layout_group":
      case "set_layout_constraint":
      case "remove_layout_constraint":
      case "align_instances": {
        const outcome = applyPresentationLayoutEdit(edit, {
          draft,
          resolver,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome.rejection;
        if (outcome.connectivityChanged) connectivityChanged = true;
        break;
      }
    }
    geometryChanged = true;
  }

  if (
    resolver &&
    transaction.edits.some(
      (edit) =>
        edit.kind === "move_instance" ||
        edit.kind === "rotate_instance" ||
        edit.kind === "mirror_instance",
    )
  ) {
    const directContact = reconcileTransformDirectContacts(
      document,
      draft,
      resolver,
      transaction.transactionId,
      changedObjectIds,
    );
    geometryChanged ||= directContact.geometryChanged;
    for (const routeId of directContact.changedRouteIds) {
      changedRouteIds.add(routeId);
    }
  }

  if (resolver) {
    // Keep geometry incidence separate from the broader transaction diff.
    // Net merges retarget many Routes for bookkeeping, but that must not turn
    // an otherwise local edit into a whole-document geometry repair.
    const physicalContactObjectIds =
      physicalContactObjectIdsForTransaction(transaction);
    const suppressedPhysicalEndpointKeys = new Set(
      transaction.edits.flatMap((edit) =>
        edit.kind === "disconnect_endpoint" ? [endpointKey(edit.endpoint)] : [],
      ),
    );
    const operationLimit = Math.max(
      32,
      (draft.instances.length + draft.junctions.length) *
        Math.max(2, draft.routes.length + 1) *
        2,
    );
    for (
      let operationIndex = 0;
      operationIndex < operationLimit;
      operationIndex += 1
    ) {
      const operation = nextPhysicalContactOperation(
        draft,
        resolver,
        physicalContactObjectIds,
        suppressedPhysicalEndpointKeys,
      );
      if (!operation) break;

      if (operation.kind === "connect-endpoints") {
        let leftOwner = endpointOwnerNetId(draft, operation.left);
        let rightOwner = endpointOwnerNetId(draft, operation.right);
        if (!leftOwner && !rightOwner) {
          const netId = uniquePhysicalContactId(
            draft,
            "net",
            transaction.transactionId,
            [endpointKey(operation.left), endpointKey(operation.right)]
              .sort((left, right) => left.localeCompare(right, "en"))
              .join("--"),
          );
          draft.nets.push({ id: netId, terminals: [] });
          changedObjectIds.add(netId);
          leftOwner = netId;
          rightOwner = netId;
        } else if (!leftOwner) {
          leftOwner = rightOwner;
        } else if (!rightOwner) {
          rightOwner = leftOwner;
        }
        if (!leftOwner || !rightOwner) {
          return rejectTransaction(
            document,
            "INVALID_RESULT",
            "Physical contact normalization could not assign a Base Net",
          );
        }
        if (leftOwner !== rightOwner) {
          const [targetNetId, sourceNetId] = preferredPhysicalMergeTarget(
            draft,
            leftOwner,
            rightOwner,
          );
          const merge = mergeBaseNets(
            draft,
            targetNetId,
            sourceNetId,
            changedObjectIds,
          );
          if (!merge.ok) {
            return rejectTransaction(
              document,
              merge.code,
              merge.message,
              [],
              merge.netIds,
            );
          }
          leftOwner = targetNetId;
          rightOwner = targetNetId;
        }
        addEndpointToNet(draft, leftOwner, operation.left);
        addEndpointToNet(draft, rightOwner, operation.right);
        removeNoConnectForEndpoint(draft, operation.left, changedObjectIds);
        removeNoConnectForEndpoint(draft, operation.right, changedObjectIds);
        changedObjectIds.add(leftOwner);
        connectivityChanged = true;
        continue;
      }

      let route = draft.routes.find(
        (candidate) => candidate.id === operation.routeId,
      );
      if (!route) {
        return rejectTransaction(
          document,
          "INVALID_RESULT",
          `Physical contact Route disappeared: ${operation.routeId}`,
        );
      }
      if (routeIsProtected(route)) {
        return rejectTransaction(
          document,
          "EDIT_PRECONDITION",
          `Cannot attach a physical contact to locked Route ${route.id}`,
          [],
          [route.id],
        );
      }
      const endpointOwner = endpointOwnerNetId(draft, operation.endpoint);
      if (endpointOwner && endpointOwner !== route.netId) {
        const [targetNetId, sourceNetId] = preferredPhysicalMergeTarget(
          draft,
          endpointOwner,
          route.netId,
        );
        const merge = mergeBaseNets(
          draft,
          targetNetId,
          sourceNetId,
          changedObjectIds,
        );
        if (!merge.ok) {
          return rejectTransaction(
            document,
            merge.code,
            merge.message,
            [],
            merge.netIds,
          );
        }
        route = draft.routes.find(
          (candidate) => candidate.id === operation.routeId,
        );
        if (!route) {
          return rejectTransaction(
            document,
            "INVALID_RESULT",
            `Physical contact Route disappeared after Net merge: ${operation.routeId}`,
          );
        }
      }
      const markerAnchors = captureRouteMarkerAnchors(draft, resolver).filter(
        (anchor) => anchor.routeId === route.id,
      );
      const seed = `${route.id}:${endpointKey(operation.endpoint)}:${operation.point.x},${operation.point.y}`;
      // Keep the original ID on the from-side so selection, drag state, and
      // callers holding a revision-local Route address remain valid after an
      // automatic split. Only the newly created far side needs a fresh ID.
      const firstRouteId = route.id;
      const secondRouteId = uniquePhysicalContactId(
        draft,
        "route",
        transaction.transactionId,
        `${seed}:second`,
      );
      const split = splitRoute(
        draft,
        route,
        operation.endpoint,
        operation.point,
        firstRouteId,
        secondRouteId,
        operation.segmentIndex,
        resolver,
      );
      if (typeof split === "string") {
        return rejectTransaction(
          document,
          "EDIT_PRECONDITION",
          split,
          [],
          [route.id],
        );
      }
      addEndpointToNet(draft, route.netId, operation.endpoint);
      const routeIndex = draft.routes.findIndex(
        (candidate) => candidate.id === route!.id,
      );
      draft.routes.splice(routeIndex, 1, split.first, split.second);
      retargetConnectivityEvidenceOwner(
        draft,
        route.id,
        split.first.id,
        changedObjectIds,
      );
      for (const candidate of [split.first, split.second]) {
        const routeError = validateRoute(draft, candidate, resolver);
        if (routeError) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            routeError,
            [],
            [candidate.id],
          );
        }
      }
      remapRouteMarkersAfterSplit(
        draft,
        resolver,
        markerAnchors,
        [split.first.id, split.second.id],
        changedObjectIds,
      );
      removeNoConnectForEndpoint(draft, operation.endpoint, changedObjectIds);
      for (const routeId of [route.id, split.first.id, split.second.id]) {
        changedObjectIds.add(routeId);
        changedRouteIds.add(routeId);
      }
      physicalContactObjectIds.add(split.first.id);
      physicalContactObjectIds.add(split.second.id);
      changedObjectIds.add(route.netId);
      connectivityChanged = true;
      geometryChanged = true;

      if (operationIndex === operationLimit - 1) {
        return rejectTransaction(
          document,
          "INVALID_RESULT",
          "Physical contact normalization did not converge",
        );
      }
    }
  }

  const invalidatedBulkDefault = revokeInvalidatedSupplyBulkDefaults(
    document,
    draft,
    changedObjectIds,
    deferNetPrune,
  );
  connectivityChanged ||= invalidatedBulkDefault;
  const reconciledBulkBinding = reconcileMaterializedMosBulkBindings(
    draft,
    changedObjectIds,
    deferNetPrune,
  );
  connectivityChanged ||= reconciledBulkBinding;
  const netCountBeforeDeferredPrune = draft.nets.length;
  const evidenceCountBeforeDeferredPrune = draft.connectivityEvidence.length;
  for (const netId of deferredNetPruneIds) {
    pruneUnreachableLocalNet(draft, netId, changedObjectIds, {
      protectedEvidenceIds,
    });
  }
  connectivityChanged ||=
    draft.nets.length !== netCountBeforeDeferredPrune ||
    draft.connectivityEvidence.length !== evidenceCountBeforeDeferredPrune;

  const introducedNetContractIssue = validateLogicalNetContract(draft).find(
    (issue) =>
      !originalNetContractIssueKeys.has(logicalNetContractIssueKey(issue)),
  );
  if (introducedNetContractIssue) {
    const message =
      introducedNetContractIssue.code === "CONFLICTING_LOGICAL_NET_SCOPE"
        ? "Transaction introduces conflicting Logical Net scopes"
        : introducedNetContractIssue.code ===
            "CONFLICTING_LOGICAL_NET_POWER_DOMAIN"
          ? "Transaction connects incompatible power markers"
          : "Transaction introduces conflicting Logical Net names";
    return rejectTransaction(
      document,
      "INVALID_RESULT",
      message,
      [],
      introducedNetContractIssue.netIds,
    );
  }

  if (resolver) {
    for (const route of draft.routes) {
      const routeError = validateRoute(draft, route, resolver);
      const original = originalRouteStates.get(route.id);
      const resolvedPoints =
        resolveRouteEditPath(draft, resolver, route)?.points ?? null;
      const resolvedGeometryChanged =
        original === undefined ||
        !sameResolvedRoutePoints(original.points, resolvedPoints);
      if (routeError) {
        const unchangedPreexistingError =
          original !== undefined &&
          !resolvedGeometryChanged &&
          original.error === routeError;
        if (!unchangedPreexistingError) {
          return rejectTransaction(
            document,
            "INVALID_RESULT",
            `Transaction leaves invalid Route geometry for ${route.id}: ${routeError}`,
            [],
            ["routes", route.id],
          );
        }
      }
      if (original !== undefined && resolvedGeometryChanged) {
        changedObjectIds.add(route.id);
        changedRouteIds.add(route.id);
      }
    }
    followNetLabelsOnChangedRoutes(
      draft,
      resolver,
      originalNetLabelAnchors,
      changedRouteIds,
      changedObjectIds,
    );
    followRouteMarkersOnChangedRoutes(
      draft,
      resolver,
      originalRouteMarkerAnchors,
      changedRouteIds,
      changedObjectIds,
    );
  }

  if (connectivityChanged) {
    draft.sourceStatus = "connectivity-modified";
  } else if (geometryChanged && draft.sourceStatus === "in-sync") {
    draft.sourceStatus = "geometry-only-changed";
  }
  draft.revision = proposedRevision;

  const candidate = SchematicDocumentSchema.safeParse(draft);
  if (!candidate.success) {
    return rejectTransaction(
      document,
      "INVALID_RESULT",
      "Transaction result failed Document validation",
      schemaDiagnostics(candidate.error, "INVALID_RESULT"),
    );
  }

  const diff: EditDiff = {
    documentId: document.id,
    fromRevision: document.revision,
    toRevision: proposedRevision,
    editKinds: transaction.edits.map((edit) => edit.kind),
    changedObjectIds: [...changedObjectIds].sort(),
  };

  if (transaction.dryRun === true) {
    // Return the validated candidate (draft) so callers can inspect the
    // proposed geometry, not the pre-edit Document. The caller never commits
    // this: the Adapter only commits when `applied` is true.
    return {
      ok: true,
      applied: false,
      revision: document.revision,
      proposedRevision,
      document: candidate.data,
      diff,
      diagnostics: [],
    };
  }

  return {
    ok: true,
    applied: true,
    revision: candidate.data.revision,
    proposedRevision,
    document: candidate.data,
    diff,
    diagnostics: [],
  };
}
