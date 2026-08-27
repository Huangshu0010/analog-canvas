import {
  AnnotationSchema,
  ConnectivityEvidenceSchema,
  JunctionSchema,
  SchematicDocumentSchema,
  deriveStableId,
} from "@icm/model";
import type { SchematicDocument } from "@icm/model";
import {
  endpointKey,
  hasExplicitMosBulkRoute,
  isMosBulkRoute,
  logicalNetContractIssueKey,
  mosBulkKind,
  resolveDetachedMosBulkDefault,
  resolveDocumentLogicalNets,
  resolveMosBulkConnection,
  validateLogicalNetContract,
} from "@icm/derived";
import { EditTransactionSchema, type EditTransaction } from "./edit-schema.js";
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
import { applyRouteGeometryEdit } from "./transaction-route-geometry.js";
import { applyRouteTopologyEdit } from "./transaction-route-topology.js";
import { applyPresentationLayoutEdit } from "./transaction-presentation-layout.js";
import {
  connectivityEvidenceNetIds,
  implicitBulkPresentation,
  mergeBaseNets,
  physicalContactObjectIdsForTransaction,
  preferredPhysicalMergeTarget,
  pruneUnreachableLocalNet,
  reconcileMaterializedMosBulkBindings,
  removeConnectivityEvidenceOwnedBy,
  removeNoConnectForEndpoint,
  retargetConnectivityEvidenceOwner,
  revokeInvalidatedSupplyBulkDefaults,
  uniquePhysicalContactId,
} from "./transaction-connectivity.js";
import {
  addEndpointToNet,
  endpointOwnerNetId,
  lockedLayoutOwner,
  routeIsProtected,
  sameResolvedRoutePoints,
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
      case "set_route_points":
      case "route_orthogonal": {
        const outcome = applyRouteGeometryEdit(edit, {
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
      case "add_junction":
      case "attach_endpoint_to_route":
      case "remove_junction":
      case "move_junction": {
        const outcome = applyRouteTopologyEdit(edit, {
          draft,
          resolver,
          explicitlyAuthoredRouteIds,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome;
        connectivityChanged ||= outcome.connectivityChanged;
        break;
      }
      case "remove_route_geometry": {
        const outcome = applyRouteGeometryEdit(edit, {
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
      case "cut_connection":
      case "connect_endpoints": {
        const outcome = applyRouteTopologyEdit(edit, {
          draft,
          resolver,
          explicitlyAuthoredRouteIds,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome;
        connectivityChanged ||= outcome.connectivityChanged;
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
        const outcome = applyRouteTopologyEdit(edit, {
          draft,
          resolver,
          explicitlyAuthoredRouteIds,
          changedObjectIds,
          deferNetPrune,
          reject: rejectAt,
        });
        if (!outcome.ok) return outcome;
        connectivityChanged ||= outcome.connectivityChanged;
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
