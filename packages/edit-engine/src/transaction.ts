import {
  JunctionSchema,
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
export const MakeFlightlineEditSchema = z.strictObject({
  kind: z.literal("make_flightline"),
  routeId: StableIdSchema,
});
export const UndoEditSchema = z.strictObject({ kind: z.literal("undo") });
export const RedoEditSchema = z.strictObject({ kind: z.literal("redo") });

export const SchematicEditSchema = z.discriminatedUnion("kind", [
  NoopEditSchema,
  PlaceInstanceEditSchema,
  MoveInstanceEditSchema,
  RotateInstanceEditSchema,
  MirrorInstanceEditSchema,
  SetRoutePointsEditSchema,
  AddJunctionEditSchema,
  RemoveJunctionEditSchema,
  MakeFlightlineEditSchema,
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

function pointOnSegmentInclusive(
  point: Point,
  from: Point,
  to: Point,
): boolean {
  if (from.x === to.x) {
    return (
      point.x === from.x &&
      point.y >= Math.min(from.y, to.y) &&
      point.y <= Math.max(from.y, to.y)
    );
  }
  if (from.y === to.y) {
    return (
      point.y === from.y &&
      point.x >= Math.min(from.x, to.x) &&
      point.x <= Math.max(from.x, to.x)
    );
  }
  return false;
}

function routeIsProtected(route: RouteBranch): boolean {
  return route.segmentModes.includes("locked");
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

  for (const edit of transaction.edits) {
    switch (edit.kind) {
      case "noop":
      case "undo":
      case "redo":
        continue;
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
        if (instance.placement === null) {
          return rejectTransaction(
            document,
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        instance.placement.position = structuredClone(edit.position);
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
          const conflictingRoute = draft.routes.find((candidate) => {
            if (candidate.id === route.id) return false;
            const polyline = routePolyline(draft, resolver, candidate);
            return polyline?.points
              .slice(1)
              .some((point, index) =>
                pointOnSegmentInclusive(
                  edit.position,
                  polyline.points[index]!,
                  point,
                ),
              );
          });
          if (conflictingRoute) {
            return rejectTransaction(
              document,
              "EDIT_PRECONDITION",
              `Junction position also lies on route ${conflictingRoute.id}; split every participating branch in one explicit connection operation`,
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
    }
    geometryChanged = true;
  }

  if (geometryChanged && draft.sourceStatus === "in-sync") {
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
