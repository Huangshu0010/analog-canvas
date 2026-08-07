import {
  AnnotationSchema,
  InstanceSchema,
  JunctionSchema,
  LayoutConstraintSchema,
  LayoutGroupSchema,
  MirrorSchema,
  PlacementSchema,
  PointSchema,
  RouteEndpointSchema,
  RotationSchema,
  SegmentModeSchema,
  SchematicDocumentSchema,
  StableIdSchema,
} from "@icm/model";
import type {
  Point,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import {
  endpointKey,
  endpointBelongsToNet,
  isOrthogonal,
  normalizeRouteGeometry,
  routePolyline,
} from "@icm/derived";
import type { SymbolResolver } from "@icm/symbols";
import { z } from "zod";

export const EditActorSchema = z.strictObject({
  kind: z.enum(["human", "agent"]),
  id: StableIdSchema,
});

export const NoopEditSchema = z.strictObject({
  kind: z.literal("noop"),
  reason: z.string().min(1).optional(),
});
export const AddInstanceEditSchema = z.strictObject({
  kind: z.literal("add_instance"),
  instance: InstanceSchema,
});
export const RemoveInstanceEditSchema = z.strictObject({
  kind: z.literal("remove_instance"),
  instanceId: StableIdSchema,
});
export const PlaceInstanceEditSchema = z.strictObject({
  kind: z.literal("place_instance"),
  instanceId: StableIdSchema,
  placement: PlacementSchema,
});
export const MoveInstanceEditSchema = z.strictObject({
  kind: z.literal("move_instance"),
  instanceId: StableIdSchema,
  position: PointSchema,
});
export const RotateInstanceEditSchema = z.strictObject({
  kind: z.literal("rotate_instance"),
  instanceId: StableIdSchema,
  rotation: RotationSchema,
});
export const MirrorInstanceEditSchema = z.strictObject({
  kind: z.literal("mirror_instance"),
  instanceId: StableIdSchema,
  mirror: MirrorSchema,
});
export const SetRoutePointsEditSchema = z.strictObject({
  kind: z.literal("set_route_points"),
  routeId: StableIdSchema,
  netId: StableIdSchema,
  from: RouteEndpointSchema,
  to: RouteEndpointSchema,
  waypoints: z.array(PointSchema),
  segmentModes: z.array(SegmentModeSchema),
});
export const AddJunctionEditSchema = z.strictObject({
  kind: z.literal("add_junction"),
  junctionId: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
  split: z
    .strictObject({
      routeId: StableIdSchema,
      firstRouteId: StableIdSchema,
      secondRouteId: StableIdSchema,
      segmentIndex: z.number().int().nonnegative(),
    })
    .optional(),
});
export const RemoveJunctionEditSchema = z.strictObject({
  kind: z.literal("remove_junction"),
  junctionId: StableIdSchema,
});
export const MoveJunctionEditSchema = z.strictObject({
  kind: z.literal("move_junction"),
  junctionId: StableIdSchema,
  position: PointSchema,
});
export const MakeFlightlineEditSchema = z.strictObject({
  kind: z.literal("make_flightline"),
  routeId: StableIdSchema,
});
export const ConnectEndpointsEditSchema = z.strictObject({
  kind: z.literal("connect_endpoints"),
  from: RouteEndpointSchema,
  to: RouteEndpointSchema,
  newNetId: StableIdSchema.optional(),
  newNetName: z.string().min(1).optional(),
});
export const MergeNetsEditSchema = z.strictObject({
  kind: z.literal("merge_nets"),
  targetNetId: StableIdSchema,
  sourceNetId: StableIdSchema,
});
export const SetNetNameEditSchema = z.strictObject({
  kind: z.literal("set_net_name"),
  netId: StableIdSchema,
  name: z.string().trim().min(1).max(256),
});
export const DisconnectEndpointEditSchema = z.strictObject({
  kind: z.literal("disconnect_endpoint"),
  endpoint: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("terminal"),
      instanceId: StableIdSchema,
      pinName: z.string().min(1),
    }),
    z.strictObject({ kind: z.literal("port"), portId: StableIdSchema }),
  ]),
});
export const UpsertAnnotationEditSchema = z.strictObject({
  kind: z.literal("upsert_annotation"),
  annotation: AnnotationSchema,
});
export const RemoveAnnotationEditSchema = z.strictObject({
  kind: z.literal("remove_annotation"),
  annotationId: StableIdSchema,
});
export const SetLayoutGroupEditSchema = z.strictObject({
  kind: z.literal("set_layout_group"),
  group: LayoutGroupSchema,
});
export const RemoveLayoutGroupEditSchema = z.strictObject({
  kind: z.literal("remove_layout_group"),
  groupId: StableIdSchema,
});
export const SetLayoutConstraintEditSchema = z.strictObject({
  kind: z.literal("set_layout_constraint"),
  constraint: LayoutConstraintSchema,
});
export const RemoveLayoutConstraintEditSchema = z.strictObject({
  kind: z.literal("remove_layout_constraint"),
  constraintId: StableIdSchema,
});
export const AlignInstancesEditSchema = z.strictObject({
  kind: z.literal("align_instances"),
  instanceIds: z.array(StableIdSchema).min(2).max(64),
  axis: z.enum(["x", "y"]),
  coordinate: z.number().int().optional(),
});
export const UndoEditSchema = z.strictObject({ kind: z.literal("undo") });
export const RedoEditSchema = z.strictObject({ kind: z.literal("redo") });

export const SchematicEditSchema = z.discriminatedUnion("kind", [
  NoopEditSchema,
  AddInstanceEditSchema,
  RemoveInstanceEditSchema,
  PlaceInstanceEditSchema,
  MoveInstanceEditSchema,
  RotateInstanceEditSchema,
  MirrorInstanceEditSchema,
  SetRoutePointsEditSchema,
  AddJunctionEditSchema,
  RemoveJunctionEditSchema,
  MoveJunctionEditSchema,
  MakeFlightlineEditSchema,
  ConnectEndpointsEditSchema,
  MergeNetsEditSchema,
  SetNetNameEditSchema,
  DisconnectEndpointEditSchema,
  UpsertAnnotationEditSchema,
  RemoveAnnotationEditSchema,
  SetLayoutGroupEditSchema,
  RemoveLayoutGroupEditSchema,
  SetLayoutConstraintEditSchema,
  RemoveLayoutConstraintEditSchema,
  AlignInstancesEditSchema,
  UndoEditSchema,
  RedoEditSchema,
]);

export const EditTransactionSchema = z.strictObject({
  transactionId: StableIdSchema,
  documentId: StableIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  actor: EditActorSchema,
  dryRun: z.boolean().optional(),
  edits: z.array(SchematicEditSchema).min(1).max(256),
});

export type EditActor = z.infer<typeof EditActorSchema>;
export type SchematicEdit = z.infer<typeof SchematicEditSchema>;
export type EditTransaction = z.infer<typeof EditTransactionSchema>;

export type EditErrorCode =
  | "INVALID_TRANSACTION"
  | "DOCUMENT_MISMATCH"
  | "STALE_REVISION"
  | "OBJECT_NOT_FOUND"
  | "EDIT_PRECONDITION"
  | "EDIT_CONTEXT_REQUIRED"
  | "HISTORY_CONTEXT_REQUIRED"
  | "HISTORY_EMPTY"
  | "INVALID_RESULT";

export interface EditDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: ReadonlyArray<string | number>;
}

export interface EditDiff {
  documentId: string;
  fromRevision: number;
  toRevision: number;
  editKinds: readonly SchematicEdit["kind"][];
  changedObjectIds: readonly string[];
}

export interface AppliedTransaction {
  ok: true;
  applied: boolean;
  revision: number;
  proposedRevision: number;
  document: SchematicDocument;
  diff: EditDiff;
  diagnostics: readonly EditDiagnostic[];
}

export interface RejectedTransaction {
  ok: false;
  applied: false;
  revision: number;
  document: SchematicDocument;
  error: {
    code: EditErrorCode;
    message: string;
  };
  diagnostics: readonly EditDiagnostic[];
}

export type EditTransactionResult = AppliedTransaction | RejectedTransaction;

export interface EditExecutionContext {
  symbolResolver?: SymbolResolver;
}

export function rejectTransaction(
  document: SchematicDocument,
  code: EditErrorCode,
  message: string,
  diagnostics: readonly EditDiagnostic[] = [],
): RejectedTransaction {
  return {
    ok: false,
    applied: false,
    revision: document.revision,
    document,
    error: { code, message },
    diagnostics,
  };
}

function schemaDiagnostics(error: z.ZodError, code: string): EditDiagnostic[] {
  return error.issues.map((issue) => ({
    code,
    severity: "error" as const,
    message: issue.message,
    path: issue.path.map((segment) =>
      typeof segment === "symbol" ? (segment.description ?? "symbol") : segment,
    ),
  }));
}

function isHistoryEdit(
  edit: SchematicEdit,
): edit is Extract<SchematicEdit, { kind: "undo" | "redo" }> {
  return edit.kind === "undo" || edit.kind === "redo";
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  if (from.x === to.x) {
    return (
      point.x === from.x &&
      point.y > Math.min(from.y, to.y) &&
      point.y < Math.max(from.y, to.y)
    );
  }
  if (from.y === to.y) {
    return (
      point.y === from.y &&
      point.x > Math.min(from.x, to.x) &&
      point.x < Math.max(from.x, to.x)
    );
  }
  return false;
}

function routeIsProtected(route: RouteBranch): boolean {
  return route.segmentModes.includes("locked");
}

function endpointOwnerNetId(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
): string | null {
  switch (endpoint.kind) {
    case "terminal":
      return (
        document.nets.find((net) =>
          net.terminals.some(
            (terminal) =>
              terminal.instanceId === endpoint.instanceId &&
              terminal.pinName === endpoint.pinName,
          ),
        )?.id ?? null
      );
    case "port":
      return (
        document.nets.find((net) => net.ports.includes(endpoint.portId))?.id ??
        null
      );
    case "junction":
      return (
        document.junctions.find(
          (junction) => junction.id === endpoint.junctionId,
        )?.netId ?? null
      );
  }
}

function validateConnectableEndpoint(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
  resolver: SymbolResolver | undefined,
): string | null {
  switch (endpoint.kind) {
    case "terminal": {
      const instance = document.instances.find(
        (candidate) => candidate.id === endpoint.instanceId,
      );
      if (!instance) return `Instance does not exist: ${endpoint.instanceId}`;
      if (!resolver) return "Terminal edits require a Symbol Resolver";
      const symbol = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (
        !symbol?.definition.pins.some((pin) => pin.name === endpoint.pinName)
      ) {
        return `Symbol pin does not exist: ${endpoint.instanceId}.${endpoint.pinName}`;
      }
      return null;
    }
    case "port":
      return document.ports.some((port) => port.id === endpoint.portId)
        ? null
        : `Port does not exist: ${endpoint.portId}`;
    case "junction":
      return document.junctions.some(
        (junction) => junction.id === endpoint.junctionId,
      )
        ? null
        : `Junction does not exist: ${endpoint.junctionId}`;
  }
}

function addEndpointToNet(
  document: SchematicDocument,
  netId: string,
  endpoint: RouteEndpoint,
): void {
  const net = document.nets.find((candidate) => candidate.id === netId)!;
  if (endpoint.kind === "terminal") {
    if (
      !net.terminals.some(
        (terminal) =>
          terminal.instanceId === endpoint.instanceId &&
          terminal.pinName === endpoint.pinName,
      )
    ) {
      net.terminals.push({
        instanceId: endpoint.instanceId,
        pinName: endpoint.pinName,
      });
    }
  } else if (endpoint.kind === "port" && !net.ports.includes(endpoint.portId)) {
    net.ports.push(endpoint.portId);
  }
}

function replaceLayoutReference(
  objectIds: string[],
  sourceId: string,
  targetId: string,
): string[] {
  return [...new Set(objectIds.map((id) => (id === sourceId ? targetId : id)))];
}

function lockedLayoutOwner(
  document: SchematicDocument,
  objectId: string,
): string | null {
  return (
    [...document.layoutGroups, ...document.constraints].find(
      (item) => item.locked && item.objectIds.includes(objectId),
    )?.id ?? null
  );
}

function routeFromEdit(
  edit: Extract<SchematicEdit, { kind: "set_route_points" }>,
): RouteBranch {
  return {
    id: edit.routeId,
    netId: edit.netId,
    from: structuredClone(edit.from),
    to: structuredClone(edit.to),
    waypoints: structuredClone(edit.waypoints),
    segmentModes: [...edit.segmentModes],
  };
}

function validateRoute(
  document: SchematicDocument,
  route: RouteBranch,
  resolver: SymbolResolver,
): string | null {
  if (route.segmentModes.length !== route.waypoints.length + 1) {
    return `Route ${route.id} requires one segment mode per geometric segment`;
  }
  const net = document.nets.find((candidate) => candidate.id === route.netId);
  if (!net) return `Route net does not exist: ${route.netId}`;
  if (!endpointBelongsToNet(document, net, route.from)) {
    return `Route from endpoint is not a member of ${route.netId}`;
  }
  if (!endpointBelongsToNet(document, net, route.to)) {
    return `Route to endpoint is not a member of ${route.netId}`;
  }
  const polyline = routePolyline(document, resolver, route);
  if (!polyline) return `Route ${route.id} has an unresolved endpoint`;
  if (!isOrthogonal(polyline.points)) {
    return `Route ${route.id} must contain only non-zero orthogonal segments`;
  }
  return null;
}

function splitRoute(
  document: SchematicDocument,
  route: RouteBranch,
  junctionId: string,
  position: Point,
  firstRouteId: string,
  secondRouteId: string,
  segmentIndex: number,
  resolver: SymbolResolver,
): { first: RouteBranch; second: RouteBranch } | string {
  const polyline = routePolyline(document, resolver, route);
  if (!polyline) return `Route ${route.id} has an unresolved endpoint`;
  if (segmentIndex >= polyline.points.length - 1) {
    return `Route split segment is out of range: ${segmentIndex}`;
  }
  const segmentFrom = polyline.points[segmentIndex]!;
  const segmentTo = polyline.points[segmentIndex + 1]!;
  if (!pointOnSegment(position, segmentFrom, segmentTo)) {
    return `Junction position is not inside route segment ${segmentIndex}`;
  }
  const junctionEndpoint: RouteEndpoint = { kind: "junction", junctionId };
  const firstNormalized = normalizeRouteGeometry(
    [...polyline.points.slice(0, segmentIndex + 1), position],
    route.segmentModes.slice(0, segmentIndex + 1),
  );
  const secondNormalized = normalizeRouteGeometry(
    [position, ...polyline.points.slice(segmentIndex + 1)],
    [
      route.segmentModes[segmentIndex]!,
      ...route.segmentModes.slice(segmentIndex + 1),
    ],
  );
  return {
    first: {
      id: firstRouteId,
      netId: route.netId,
      from: structuredClone(route.from),
      to: junctionEndpoint,
      waypoints: firstNormalized.points.slice(1, -1),
      segmentModes: firstNormalized.segmentModes,
    },
    second: {
      id: secondRouteId,
      netId: route.netId,
      from: junctionEndpoint,
      to: structuredClone(route.to),
      waypoints: secondNormalized.points.slice(1, -1),
      segmentModes: secondNormalized.segmentModes,
    },
  };
}

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
      "Undo and redo require a DocumentHistory session",
    );
  }

  const proposedRevision = document.revision + 1;
  const draft = structuredClone(document);
  const changedObjectIds = new Set<string>();
  let geometryChanged = false;
  let connectivityChanged = false;

  for (const edit of transaction.edits) {
    switch (edit.kind) {
      case "noop":
      case "undo":
      case "redo":
        continue;
      case "add_instance": {
        const objectIdExists = [
          ...draft.ports,
          ...draft.instances,
          ...draft.nets,
          ...draft.routes,
          ...draft.junctions,
          ...draft.annotations,
          ...draft.layoutGroups,
          ...draft.constraints,
        ].some((candidate) => candidate.id === edit.instance.id);
        if (objectIdExists) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Object ID already exists: ${edit.instance.id}`,
          );
        }
        const resolver = context.symbolResolver;
        if (
          !resolver?.resolve(
            edit.instance.symbolId,
            edit.instance.symbolVariantId,
          )
        ) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Symbol does not exist: ${edit.instance.symbolId}`,
          );
        }
        draft.instances.push(InstanceSchema.parse(edit.instance));
        changedObjectIds.add(edit.instance.id);
        connectivityChanged = true;
        break;
      }
      case "remove_instance": {
        const index = draft.instances.findIndex(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (index < 0) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        const referenced =
          draft.nets.some((net) =>
            net.terminals.some(
              (terminal) => terminal.instanceId === edit.instanceId,
            ),
          ) ||
          draft.annotations.some(
            (annotation) => annotation.attachedObjectId === edit.instanceId,
          ) ||
          draft.layoutGroups.some((group) =>
            group.objectIds.includes(edit.instanceId),
          ) ||
          draft.constraints.some((constraint) =>
            constraint.objectIds.includes(edit.instanceId),
          );
        if (referenced) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is still connected or referenced: ${edit.instanceId}`,
          );
        }
        draft.instances.splice(index, 1);
        changedObjectIds.add(edit.instanceId);
        connectivityChanged = true;
        break;
      }
      case "place_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        if (instance.placement !== null) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is already placed: ${edit.instanceId}`,
          );
        }
        instance.placement = structuredClone(edit.placement);
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "move_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        const delta = {
          x: edit.position.x - instance.placement.position.x,
          y: edit.position.y - instance.placement.position.y,
        };
        instance.placement.position = structuredClone(edit.position);
        for (const annotation of draft.annotations) {
          if (annotation.attachedObjectId === edit.instanceId) {
            annotation.position.x += delta.x;
            annotation.position.y += delta.y;
            changedObjectIds.add(annotation.id);
          }
        }
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "rotate_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        instance.placement.rotation = edit.rotation;
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "mirror_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        instance.placement.mirror = edit.mirror;
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "set_route_points": {
        const resolver = context.symbolResolver;
        if (!resolver) {
          return rejectTransaction(
            document,
            "EDIT_CONTEXT_REQUIRED",
            "Routing edits require a Symbol Resolver",
          );
        }
        const existingIndex = draft.routes.findIndex(
          (candidate) => candidate.id === edit.routeId,
        );
        const existing = draft.routes[existingIndex];
        if (existing && routeIsProtected(existing)) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${edit.routeId}`,
          );
        }
        const route = routeFromEdit(edit);
        const routeError = validateRoute(draft, route, resolver);
        if (routeError) {
          return rejectTransaction(document, "EDIT_PRECONDITION", routeError);
        }
        const polyline = routePolyline(draft, resolver, route)!;
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
      case "add_junction": {
        if (!draft.nets.some((net) => net.id === edit.netId)) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Junction net does not exist: ${edit.netId}`,
          );
        }
        if (
          draft.junctions.some((junction) => junction.id === edit.junctionId)
        ) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Junction already exists: ${edit.junctionId}`,
          );
        }
        draft.junctions.push(
          JunctionSchema.parse({
            id: edit.junctionId,
            netId: edit.netId,
            position: edit.position,
          }),
        );
        changedObjectIds.add(edit.junctionId);
        if (edit.split) {
          const resolver = context.symbolResolver;
          if (!resolver) {
            return rejectTransaction(
              document,
              "EDIT_CONTEXT_REQUIRED",
              "Route splitting requires a Symbol Resolver",
            );
          }
          const routeIndex = draft.routes.findIndex(
            (route) => route.id === edit.split!.routeId,
          );
          const route = draft.routes[routeIndex];
          if (!route) {
            return rejectTransaction(
              document,
              "OBJECT_NOT_FOUND",
              `Route does not exist: ${edit.split.routeId}`,
            );
          }
          if (route.netId !== edit.netId) {
            return rejectTransaction(
              document,
              "EDIT_PRECONDITION",
              "Junction and split route must belong to the same Net",
            );
          }
          if (routeIsProtected(route)) {
            return rejectTransaction(
              document,
              "EDIT_PRECONDITION",
              `Route contains a locked segment: ${route.id}`,
            );
          }
          const split = splitRoute(
            draft,
            route,
            edit.junctionId,
            edit.position,
            edit.split.firstRouteId,
            edit.split.secondRouteId,
            edit.split.segmentIndex,
            resolver,
          );
          if (typeof split === "string") {
            return rejectTransaction(document, "EDIT_PRECONDITION", split);
          }
          draft.routes.splice(routeIndex, 1, split.first, split.second);
          for (const splitRouteCandidate of [split.first, split.second]) {
            const routeError = validateRoute(
              draft,
              splitRouteCandidate,
              resolver,
            );
            if (routeError) {
              return rejectTransaction(
                document,
                "EDIT_PRECONDITION",
                routeError,
              );
            }
          }
          changedObjectIds.add(route.id);
          changedObjectIds.add(split.first.id);
          changedObjectIds.add(split.second.id);
        }
        connectivityChanged = true;
        break;
      }
      case "remove_junction": {
        const junctionIndex = draft.junctions.findIndex(
          (junction) => junction.id === edit.junctionId,
        );
        if (junctionIndex < 0) {
          return rejectTransaction(
            document,
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
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Junction is still used by a Route: ${edit.junctionId}`,
          );
        }
        draft.junctions.splice(junctionIndex, 1);
        changedObjectIds.add(edit.junctionId);
        connectivityChanged = true;
        break;
      }
      case "move_junction": {
        const junction = draft.junctions.find(
          (candidate) => candidate.id === edit.junctionId,
        );
        if (!junction) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Junction does not exist: ${edit.junctionId}`,
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
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Junction is attached to protected Route ${protectedRoute.id}`,
          );
        }
        junction.position = { ...edit.position };
        changedObjectIds.add(junction.id);
        break;
      }
      case "make_flightline": {
        const routeIndex = draft.routes.findIndex(
          (route) => route.id === edit.routeId,
        );
        const route = draft.routes[routeIndex];
        if (!route) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Route does not exist: ${edit.routeId}`,
          );
        }
        if (routeIsProtected(route)) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Route contains a locked segment: ${route.id}`,
          );
        }
        draft.routes.splice(routeIndex, 1);
        changedObjectIds.add(edit.routeId);
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
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            fromError ?? toError!,
          );
        }
        const fromOwner = endpointOwnerNetId(draft, edit.from);
        const toOwner = endpointOwnerNetId(draft, edit.to);
        if (fromOwner && toOwner && fromOwner !== toOwner) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Endpoints belong to different Nets; merge ${fromOwner} and ${toOwner} explicitly`,
          );
        }
        let netId = fromOwner ?? toOwner;
        if (!netId) {
          if (!edit.newNetId) {
            return rejectTransaction(
              document,
              "EDIT_PRECONDITION",
              "Two unconnected endpoints require newNetId",
            );
          }
          if (draft.nets.some((net) => net.id === edit.newNetId)) {
            return rejectTransaction(
              document,
              "EDIT_PRECONDITION",
              `Net already exists: ${edit.newNetId}`,
            );
          }
          netId = edit.newNetId;
          draft.nets.push({
            id: netId,
            ...(edit.newNetName ? { name: edit.newNetName } : {}),
            scope: "local",
            terminals: [],
            ports: [],
          });
          changedObjectIds.add(netId);
        }
        addEndpointToNet(draft, netId, edit.from);
        addEndpointToNet(draft, netId, edit.to);
        changedObjectIds.add(netId);
        connectivityChanged = true;
        break;
      }
      case "merge_nets": {
        if (edit.targetNetId === edit.sourceNetId) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            "Net merge requires two different Nets",
          );
        }
        const target = draft.nets.find((net) => net.id === edit.targetNetId);
        const sourceIndex = draft.nets.findIndex(
          (net) => net.id === edit.sourceNetId,
        );
        const source = draft.nets[sourceIndex];
        if (!target || !source) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Net merge target/source does not exist: ${edit.targetNetId}, ${edit.sourceNetId}`,
          );
        }
        for (const terminal of source.terminals) {
          if (
            !target.terminals.some(
              (candidate) =>
                candidate.instanceId === terminal.instanceId &&
                candidate.pinName === terminal.pinName,
            )
          ) {
            target.terminals.push(structuredClone(terminal));
          }
        }
        target.ports = [...new Set([...target.ports, ...source.ports])];
        for (const route of draft.routes) {
          if (route.netId === source.id) {
            route.netId = target.id;
            changedObjectIds.add(route.id);
          }
        }
        for (const junction of draft.junctions) {
          if (junction.netId === source.id) {
            junction.netId = target.id;
            changedObjectIds.add(junction.id);
          }
        }
        for (const annotation of draft.annotations) {
          if (annotation.attachedObjectId === source.id) {
            annotation.attachedObjectId = target.id;
            changedObjectIds.add(annotation.id);
          }
        }
        for (const group of draft.layoutGroups) {
          const replaced = group.objectIds.includes(source.id);
          group.objectIds = replaceLayoutReference(
            group.objectIds,
            source.id,
            target.id,
          );
          if (replaced) changedObjectIds.add(group.id);
        }
        for (const constraint of draft.constraints) {
          const replaced = constraint.objectIds.includes(source.id);
          constraint.objectIds = replaceLayoutReference(
            constraint.objectIds,
            source.id,
            target.id,
          );
          if (replaced) changedObjectIds.add(constraint.id);
        }
        draft.nets.splice(sourceIndex, 1);
        changedObjectIds.add(target.id);
        changedObjectIds.add(source.id);
        connectivityChanged = true;
        break;
      }
      case "set_net_name": {
        const net = draft.nets.find((candidate) => candidate.id === edit.netId);
        if (!net) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Net does not exist: ${edit.netId}`,
          );
        }
        const conflicting = draft.nets.find(
          (candidate) =>
            candidate.id !== net.id && candidate.name === edit.name,
        );
        if (conflicting) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Net name ${edit.name} already belongs to ${conflicting.id}; merge explicitly`,
          );
        }
        net.name = edit.name;
        changedObjectIds.add(net.id);
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
          return rejectTransaction(document, "EDIT_PRECONDITION", error);
        }
        const ownerId = endpointOwnerNetId(draft, edit.endpoint);
        if (!ownerId) {
          return rejectTransaction(
            document,
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
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            "Remove route geometry before disconnecting its endpoint",
          );
        }
        const owner = draft.nets.find((net) => net.id === ownerId)!;
        const endpoint = edit.endpoint;
        if (endpoint.kind === "terminal") {
          owner.terminals = owner.terminals.filter(
            (terminal) =>
              terminal.instanceId !== endpoint.instanceId ||
              terminal.pinName !== endpoint.pinName,
          );
        } else {
          owner.ports = owner.ports.filter(
            (portId) => portId !== endpoint.portId,
          );
        }
        changedObjectIds.add(owner.id);
        connectivityChanged = true;
        break;
      }
      case "upsert_annotation": {
        const existingIndex = draft.annotations.findIndex(
          (annotation) => annotation.id === edit.annotation.id,
        );
        const existing = draft.annotations[existingIndex];
        if (existing?.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Annotation is locked: ${existing.id}`,
          );
        }
        const annotation = AnnotationSchema.parse(edit.annotation);
        if (existingIndex >= 0) draft.annotations[existingIndex] = annotation;
        else draft.annotations.push(annotation);
        changedObjectIds.add(annotation.id);
        break;
      }
      case "remove_annotation": {
        const index = draft.annotations.findIndex(
          (annotation) => annotation.id === edit.annotationId,
        );
        const annotation = draft.annotations[index];
        if (!annotation) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Annotation does not exist: ${edit.annotationId}`,
          );
        }
        if (annotation.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Annotation is locked: ${annotation.id}`,
          );
        }
        if (
          [...draft.layoutGroups, ...draft.constraints].some((item) =>
            item.objectIds.includes(annotation.id),
          )
        ) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Annotation is referenced by layout intent: ${annotation.id}`,
          );
        }
        draft.annotations.splice(index, 1);
        changedObjectIds.add(annotation.id);
        break;
      }
      case "set_layout_group": {
        const index = draft.layoutGroups.findIndex(
          (group) => group.id === edit.group.id,
        );
        const existing = draft.layoutGroups[index];
        if (existing?.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Layout group is locked: ${existing.id}`,
          );
        }
        const group = LayoutGroupSchema.parse(edit.group);
        if (index >= 0) draft.layoutGroups[index] = group;
        else draft.layoutGroups.push(group);
        changedObjectIds.add(group.id);
        break;
      }
      case "remove_layout_group": {
        const index = draft.layoutGroups.findIndex(
          (group) => group.id === edit.groupId,
        );
        const group = draft.layoutGroups[index];
        if (!group) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Layout group does not exist: ${edit.groupId}`,
          );
        }
        if (group.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Layout group is locked: ${group.id}`,
          );
        }
        draft.layoutGroups.splice(index, 1);
        changedObjectIds.add(group.id);
        break;
      }
      case "set_layout_constraint": {
        const index = draft.constraints.findIndex(
          (constraint) => constraint.id === edit.constraint.id,
        );
        const existing = draft.constraints[index];
        if (existing?.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Layout constraint is locked: ${existing.id}`,
          );
        }
        const constraint = LayoutConstraintSchema.parse(edit.constraint);
        if (index >= 0) draft.constraints[index] = constraint;
        else draft.constraints.push(constraint);
        changedObjectIds.add(constraint.id);
        break;
      }
      case "remove_layout_constraint": {
        const index = draft.constraints.findIndex(
          (constraint) => constraint.id === edit.constraintId,
        );
        const constraint = draft.constraints[index];
        if (!constraint) {
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Layout constraint does not exist: ${edit.constraintId}`,
          );
        }
        if (constraint.locked) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Layout constraint is locked: ${constraint.id}`,
          );
        }
        draft.constraints.splice(index, 1);
        changedObjectIds.add(constraint.id);
        break;
      }
      case "align_instances": {
        if (new Set(edit.instanceIds).size !== edit.instanceIds.length) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            "Alignment instance IDs must be unique",
          );
        }
        const instances = edit.instanceIds.map((id) =>
          draft.instances.find((instance) => instance.id === id),
        );
        if (instances.some((instance) => !instance)) {
          const missing = edit.instanceIds.find(
            (id) => !draft.instances.some((instance) => instance.id === id),
          );
          return rejectTransaction(
            document,
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${missing}`,
          );
        }
        const lockedInstanceId = edit.instanceIds.find((id) =>
          lockedLayoutOwner(draft, id),
        );
        if (lockedInstanceId) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance ${lockedInstanceId} is locked by layout intent ${lockedLayoutOwner(draft, lockedInstanceId)}`,
          );
        }
        if (instances.some((instance) => instance!.placement === null)) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            "Every aligned instance must be placed",
          );
        }
        const coordinate =
          edit.coordinate ?? instances[0]!.placement!.position[edit.axis];
        for (const instance of instances) {
          const oldCoordinate = instance!.placement!.position[edit.axis];
          instance!.placement!.position[edit.axis] = coordinate;
          for (const annotation of draft.annotations) {
            if (annotation.attachedObjectId === instance!.id) {
              annotation.position[edit.axis] += coordinate - oldCoordinate;
              changedObjectIds.add(annotation.id);
            }
          }
          changedObjectIds.add(instance!.id);
        }
        break;
      }
    }
    geometryChanged = true;
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
    return {
      ok: true,
      applied: false,
      revision: document.revision,
      proposedRevision,
      document,
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
