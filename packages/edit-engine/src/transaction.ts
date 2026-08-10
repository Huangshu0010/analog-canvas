import {
  AnnotationSchema,
  DraftingObjectSchema,
  GuideSchema,
  InstanceSchema,
  JunctionRoleSchema,
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
  deriveStableId,
  inverseTransformPoint,
  transformPoint,
} from "@icm/model";
import type {
  Annotation,
  Orientation,
  Point,
  Rotation,
  RouteBranch,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import {
  buildOrthogonalEscapeRoute,
  endpointKey,
  endpointBelongsToNet,
  inferInstanceLabelSide,
  isOrthogonal,
  isMosSymbol,
  netEndpoints,
  normalizeRouteGeometry,
  placeUprightInstanceLabel,
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
  resolveSchematicStyleProfile,
  routePolyline,
  visibleSymbolLocalBounds,
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
export const SetInstanceSymbolEditSchema = z.strictObject({
  kind: z.literal("set_instance_symbol"),
  instanceId: StableIdSchema,
  symbolId: StableIdSchema,
  symbolVariantId: StableIdSchema.nullable().optional(),
  pinMap: z.record(z.string().min(1), z.string().min(1)).optional(),
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
export const PlacePortEditSchema = z.strictObject({
  kind: z.literal("place_port"),
  portId: StableIdSchema,
  position: PointSchema,
});
export const MovePortEditSchema = z.strictObject({
  kind: z.literal("move_port"),
  portId: StableIdSchema,
  position: PointSchema,
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
export const RouteOrthogonalEditSchema = z.strictObject({
  kind: z.literal("route_orthogonal"),
  routeId: StableIdSchema,
  netId: StableIdSchema,
  from: RouteEndpointSchema,
  to: RouteEndpointSchema,
  escapeLength: z.number().int().positive().max(1000).optional(),
});
export const AddJunctionEditSchema = z.strictObject({
  kind: z.literal("add_junction"),
  junctionId: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
  role: JunctionRoleSchema.optional(),
  createNet: z.boolean().optional(),
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
export const CutConnectionEditSchema = z.strictObject({
  kind: z.literal("cut_connection"),
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
export const SetPresentationStyleEditSchema = z.strictObject({
  kind: z.literal("set_presentation_style"),
  styleProfileId: StableIdSchema,
});
// ADR 0010 Text & Peripheral Editing System edits (WP-A1a). These are
// additive members of the union; the legacy upsert/remove_annotation remain.
// SchematicAnnotation uses the explicit names; floating-symbol decorative
// validation runs at execute time via the Symbol Resolver.
export const UpsertSchematicAnnotationEditSchema = z.strictObject({
  kind: z.literal("upsert_schematic_annotation"),
  annotation: AnnotationSchema,
});
export const RemoveSchematicAnnotationEditSchema = z.strictObject({
  kind: z.literal("remove_schematic_annotation"),
  annotationId: StableIdSchema,
});
export const UpsertDraftingObjectEditSchema = z.strictObject({
  kind: z.literal("upsert_drafting_object"),
  object: DraftingObjectSchema,
});
export const RemoveDraftingObjectEditSchema = z.strictObject({
  kind: z.literal("remove_drafting_object"),
  objectId: StableIdSchema,
});
export const SetGuideEditSchema = z.strictObject({
  kind: z.literal("set_guide"),
  guide: GuideSchema,
});
export const RemoveGuideEditSchema = z.strictObject({
  kind: z.literal("remove_guide"),
  guideId: StableIdSchema,
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
  SetInstanceSymbolEditSchema,
  PlaceInstanceEditSchema,
  MoveInstanceEditSchema,
  RotateInstanceEditSchema,
  MirrorInstanceEditSchema,
  PlacePortEditSchema,
  MovePortEditSchema,
  SetRoutePointsEditSchema,
  RouteOrthogonalEditSchema,
  AddJunctionEditSchema,
  RemoveJunctionEditSchema,
  MoveJunctionEditSchema,
  MakeFlightlineEditSchema,
  CutConnectionEditSchema,
  ConnectEndpointsEditSchema,
  MergeNetsEditSchema,
  SetNetNameEditSchema,
  DisconnectEndpointEditSchema,
  UpsertAnnotationEditSchema,
  RemoveAnnotationEditSchema,
  SetPresentationStyleEditSchema,
  UpsertSchematicAnnotationEditSchema,
  RemoveSchematicAnnotationEditSchema,
  UpsertDraftingObjectEditSchema,
  RemoveDraftingObjectEditSchema,
  SetGuideEditSchema,
  RemoveGuideEditSchema,
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
  objectIds?: readonly string[];
  path?: ReadonlyArray<string | number>;
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
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
  path?: ReadonlyArray<string | number>,
  objectIds?: readonly string[],
): RejectedTransaction {
  const finalDiagnostics =
    path === undefined && objectIds === undefined
      ? diagnostics
      : diagnostics.map((diagnostic) => {
          const next: EditDiagnostic = { ...diagnostic };
          if (path !== undefined) {
            next.path = diagnostic.path ? [...path, ...diagnostic.path] : path;
          }
          if (objectIds !== undefined && diagnostic.objectIds === undefined) {
            next.objectIds = objectIds;
          }
          return next;
        });
  // When the caller gave no diagnostics, synthesize one so the rejection
  // itself carries the localized path/objectIds a caller needs to pinpoint.
  const synthesized =
    finalDiagnostics.length > 0
      ? finalDiagnostics
      : [
          {
            code,
            severity: "error" as const,
            message,
            ...(path === undefined ? {} : { path }),
            ...(objectIds === undefined ? {} : { objectIds }),
          },
        ];
  return {
    ok: false,
    applied: false,
    revision: document.revision,
    document,
    error: { code, message },
    diagnostics: synthesized,
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

function netEndpointGroups(
  document: SchematicDocument,
  netId: string,
): string[][] {
  const net = document.nets.find((candidate) => candidate.id === netId);
  if (!net) return [];
  const keys = netEndpoints(document, net).map(endpointKey);
  const parent = new Map(keys.map((key) => [key, key]));
  const find = (key: string): string => {
    const current = parent.get(key);
    if (!current) throw new Error(`Unknown Net endpoint ${key}`);
    if (current === key) return key;
    const root = find(current);
    parent.set(key, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    parent.set(second!, first!);
  };
  for (const route of document.routes.filter(
    (candidate) => candidate.netId === netId,
  )) {
    union(endpointKey(route.from), endpointKey(route.to));
  }
  const grouped = new Map<string, string[]>();
  for (const key of keys) {
    const root = find(key);
    const group = grouped.get(root) ?? [];
    group.push(key);
    grouped.set(root, group);
  }
  return [...grouped.values()]
    .map((group) =>
      group.sort((left, right) => left.localeCompare(right, "en")),
    )
    .sort((left, right) => left[0]!.localeCompare(right[0]!, "en"));
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
  for (const [endpoint, point, adjacent, mode] of [
    [
      route.from,
      polyline.points[0]!,
      polyline.points[1]!,
      route.segmentModes[0],
    ],
    [
      route.to,
      polyline.points.at(-1)!,
      polyline.points.at(-2)!,
      route.segmentModes.at(-1),
    ],
  ] as const) {
    if (endpoint.kind !== "terminal" || mode !== "escape") continue;
    const outward = resolveEndpointOutwardDirection(
      document,
      resolver,
      endpoint,
    );
    if (!outward) return `Route ${route.id} has an unresolved pin direction`;
    const departure = { x: adjacent.x - point.x, y: adjacent.y - point.y };
    if (departure.x * outward.x + departure.y * outward.y <= 0) {
      return `Route ${route.id} escape segment must leave ${endpoint.instanceId}.${endpoint.pinName} outward`;
    }
  }
  return null;
}

function sameResolvedRoutePoints(
  left: readonly Point[] | null,
  right: readonly Point[] | null,
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.length === right.length &&
    left.every(
      (point, index) =>
        point.x === right[index]!.x && point.y === right[index]!.y,
    )
  );
}

interface NetLabelRouteAnchor {
  annotationId: string;
  routeId: string;
  segmentIndex: number;
  segmentCount: number;
  t: number;
  normalOffset: number;
  arcFraction: number;
}

interface RouteMarkerAnchor {
  annotationId: string;
  routeId: string;
  segmentIndex: number;
  segmentCount: number;
  t: number;
  position: Point;
  direction: Point;
  routeStart: Point;
  routeEnd: Point;
}

function closestRouteMarkerAnchor(
  points: readonly Point[],
  position: Point,
  preferredDirection: Point,
): { segmentIndex: number; t: number; distanceSquared: number } | null {
  const candidates = points.slice(0, -1).flatMap((from, segmentIndex) => {
    const to = points[segmentIndex + 1]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return [];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((position.x - from.x) * dx + (position.y - from.y) * dy) /
          lengthSquared,
      ),
    );
    const anchor = { x: from.x + dx * t, y: from.y + dy * t };
    const direction = { x: Math.sign(dx), y: Math.sign(dy) };
    return [
      {
        segmentIndex,
        t,
        distanceSquared:
          (position.x - anchor.x) ** 2 + (position.y - anchor.y) ** 2,
        directionPenalty:
          direction.x === preferredDirection.x &&
          direction.y === preferredDirection.y
            ? 0
            : direction.x === -preferredDirection.x &&
                direction.y === -preferredDirection.y
              ? 1
              : 2,
      },
    ];
  });
  const closest = candidates.sort(
    (left, right) =>
      left.distanceSquared - right.distanceSquared ||
      left.directionPenalty - right.directionPenalty ||
      left.segmentIndex - right.segmentIndex,
  )[0];
  return closest
    ? {
        segmentIndex: closest.segmentIndex,
        t: closest.t,
        distanceSquared: closest.distanceSquared,
      }
    : null;
}

function routeMarkerAttachment(annotation: Annotation) {
  if (annotation.kind !== "route-marker") return null;
  if (annotation.anchor?.kind === "route") {
    return {
      routeId: annotation.anchor.routeId,
      segmentIndex: annotation.anchor.segmentIndex,
      t: annotation.anchor.t,
      direction: annotation.anchor.direction,
      normalOffset: annotation.anchor.normalOffset,
    };
  }
  return annotation.routeAttachment ?? null;
}

function closestRouteAnchor(
  points: readonly Point[],
  position: Point,
):
  | (Omit<NetLabelRouteAnchor, "annotationId" | "routeId" | "segmentCount"> & {
      distanceSquared: number;
    })
  | null {
  const lengths = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]!;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) return null;
  let traversed = 0;
  const candidates = lengths.flatMap((length, segmentIndex) => {
    const from = points[segmentIndex]!;
    const to = points[segmentIndex + 1]!;
    if (length === 0) return [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((position.x - from.x) * dx + (position.y - from.y) * dy) /
          (length * length),
      ),
    );
    const anchor = { x: from.x + dx * t, y: from.y + dy * t };
    const delta = {
      x: position.x - anchor.x,
      y: position.y - anchor.y,
    };
    const candidate = {
      segmentIndex,
      t,
      normalOffset: delta.x * (-dy / length) + delta.y * (dx / length),
      arcFraction: (traversed + t * length) / totalLength,
      distanceSquared: delta.x * delta.x + delta.y * delta.y,
    };
    traversed += length;
    return [candidate];
  });
  return (
    candidates.sort(
      (left, right) =>
        left.distanceSquared - right.distanceSquared ||
        left.segmentIndex - right.segmentIndex,
    )[0] ?? null
  );
}

function captureNetLabelRouteAnchors(
  document: SchematicDocument,
  resolver: SymbolResolver,
): NetLabelRouteAnchor[] {
  const polylines = document.routes.flatMap((route) => {
    const polyline = routePolyline(document, resolver, route);
    return polyline ? [{ route, polyline }] : [];
  });
  return document.annotations.flatMap((annotation) => {
    if (annotation.kind !== "net-label" || !annotation.attachedObjectId) {
      return [];
    }
    const closest = polylines
      .filter(({ route }) => route.netId === annotation.attachedObjectId)
      .flatMap(({ route, polyline }) => {
        const anchor = closestRouteAnchor(polyline.points, annotation.position);
        return anchor
          ? [
              {
                ...anchor,
                annotationId: annotation.id,
                routeId: route.id,
                segmentCount: polyline.points.length - 1,
              },
            ]
          : [];
      })
      .sort(
        (left, right) =>
          left.distanceSquared - right.distanceSquared ||
          left.routeId.localeCompare(right.routeId, "en"),
      )[0];
    if (!closest) return [];
    const { distanceSquared: _distanceSquared, ...anchor } = closest;
    return [anchor];
  });
}

function captureRouteMarkerAnchors(
  document: SchematicDocument,
  resolver: SymbolResolver,
): RouteMarkerAnchor[] {
  return document.annotations.flatMap((annotation) => {
    const attachment = routeMarkerAttachment(annotation);
    if (!attachment) return [];
    const route = document.routes.find(
      (candidate) => candidate.id === attachment.routeId,
    );
    if (!route) return [];
    const polyline = routePolyline(document, resolver, route);
    if (!polyline) return [];
    const from = polyline.points[attachment.segmentIndex];
    const to = polyline.points[attachment.segmentIndex + 1];
    const routeStart = polyline.points[0];
    const routeEnd = polyline.points.at(-1);
    if (!from || !to || !routeStart || !routeEnd) return [];
    return [
      {
        annotationId: annotation.id,
        routeId: route.id,
        segmentIndex: attachment.segmentIndex,
        segmentCount: polyline.points.length - 1,
        t: attachment.t,
        position: {
          x: from.x + (to.x - from.x) * attachment.t,
          y: from.y + (to.y - from.y) * attachment.t,
        },
        direction: { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) },
        routeStart,
        routeEnd,
      },
    ];
  });
}

function pointAtArcFraction(
  points: readonly Point[],
  fraction: number,
): { segmentIndex: number; t: number } | null {
  const lengths = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]!;
    return Math.hypot(to.x - from.x, to.y - from.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return null;
  const target = Math.max(0, Math.min(1, fraction)) * total;
  let traversed = 0;
  for (const [segmentIndex, length] of lengths.entries()) {
    if (length === 0) continue;
    if (traversed + length >= target || segmentIndex === lengths.length - 1) {
      return {
        segmentIndex,
        t: Math.max(0, Math.min(1, (target - traversed) / length)),
      };
    }
    traversed += length;
  }
  return null;
}

function followNetLabelsOnChangedRoutes(
  draft: SchematicDocument,
  resolver: SymbolResolver,
  anchors: readonly NetLabelRouteAnchor[],
  changedRouteIds: ReadonlySet<string>,
  changedObjectIds: Set<string>,
): void {
  for (const captured of anchors) {
    if (
      !changedRouteIds.has(captured.routeId) ||
      changedObjectIds.has(captured.annotationId)
    ) {
      continue;
    }
    const annotation = draft.annotations.find(
      (candidate) => candidate.id === captured.annotationId,
    );
    const route = draft.routes.find(
      (candidate) => candidate.id === captured.routeId,
    );
    if (!annotation || annotation.kind !== "net-label" || !route) continue;
    const polyline = routePolyline(draft, resolver, route);
    if (!polyline) continue;
    const segmentCount = polyline.points.length - 1;
    const attachment =
      segmentCount === captured.segmentCount &&
      captured.segmentIndex < segmentCount
        ? { segmentIndex: captured.segmentIndex, t: captured.t }
        : pointAtArcFraction(polyline.points, captured.arcFraction);
    if (!attachment) continue;
    const from = polyline.points[attachment.segmentIndex]!;
    const to = polyline.points[attachment.segmentIndex + 1]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const anchor = {
      x: from.x + dx * attachment.t,
      y: from.y + dy * attachment.t,
    };
    const normal = { x: -dy / length, y: dx / length };
    const offset = {
      x: normal.x * captured.normalOffset,
      y: normal.y * captured.normalOffset,
    };
    annotation.position = {
      x: Math.round(anchor.x + offset.x),
      y: Math.round(anchor.y + offset.y),
    };
    annotation.offset = {
      x: Math.round(offset.x),
      y: Math.round(offset.y),
    };
    changedObjectIds.add(annotation.id);
  }
}

function followRouteMarkersOnChangedRoutes(
  draft: SchematicDocument,
  resolver: SymbolResolver,
  anchors: readonly RouteMarkerAnchor[],
  changedRouteIds: ReadonlySet<string>,
  changedObjectIds: Set<string>,
): void {
  for (const captured of anchors) {
    if (
      !changedRouteIds.has(captured.routeId) ||
      changedObjectIds.has(captured.annotationId)
    ) {
      continue;
    }
    const annotation = draft.annotations.find(
      (candidate) => candidate.id === captured.annotationId,
    );
    const route = draft.routes.find(
      (candidate) => candidate.id === captured.routeId,
    );
    if (!annotation || annotation.kind !== "route-marker" || !route) continue;
    const polyline = routePolyline(draft, resolver, route);
    if (!polyline) continue;
    const segmentCount = polyline.points.length - 1;
    let attachment =
      segmentCount === captured.segmentCount &&
      captured.segmentIndex < segmentCount
        ? { segmentIndex: captured.segmentIndex, t: captured.t }
        : null;
    if (!attachment) {
      const nextStart = polyline.points[0]!;
      const nextEnd = polyline.points.at(-1)!;
      const startDelta = {
        x: nextStart.x - captured.routeStart.x,
        y: nextStart.y - captured.routeStart.y,
      };
      const endDelta = {
        x: nextEnd.x - captured.routeEnd.x,
        y: nextEnd.y - captured.routeEnd.y,
      };
      const expectedPosition =
        startDelta.x === endDelta.x && startDelta.y === endDelta.y
          ? {
              x: captured.position.x + startDelta.x,
              y: captured.position.y + startDelta.y,
            }
          : captured.position;
      const closest = closestRouteMarkerAnchor(
        polyline.points,
        expectedPosition,
        captured.direction,
      );
      attachment = closest
        ? { segmentIndex: closest.segmentIndex, t: closest.t }
        : null;
    }
    if (!attachment) continue;
    const from = polyline.points[attachment.segmentIndex]!;
    const to = polyline.points[attachment.segmentIndex + 1]!;
    const position = {
      x: Math.round(from.x + (to.x - from.x) * attachment.t),
      y: Math.round(from.y + (to.y - from.y) * attachment.t),
    };
    if (annotation.anchor?.kind === "route") {
      annotation.anchor = {
        ...annotation.anchor,
        segmentIndex: attachment.segmentIndex,
        t: attachment.t,
        fallbackPosition: position,
      };
    }
    if (annotation.routeAttachment) {
      annotation.routeAttachment = {
        ...annotation.routeAttachment,
        segmentIndex: attachment.segmentIndex,
        t: attachment.t,
      };
    }
    annotation.position = position;
    changedObjectIds.add(annotation.id);
  }
}

function remapRouteMarkersAfterSplit(
  draft: SchematicDocument,
  resolver: SymbolResolver,
  anchors: readonly RouteMarkerAnchor[],
  splitRouteIds: readonly string[],
  changedObjectIds: Set<string>,
): void {
  for (const captured of anchors) {
    const closest = splitRouteIds
      .flatMap((routeId) => {
        const route = draft.routes.find(
          (candidate) => candidate.id === routeId,
        );
        const polyline = route ? routePolyline(draft, resolver, route) : null;
        if (!route || !polyline) return [];
        const attachment = closestRouteMarkerAnchor(
          polyline.points,
          captured.position,
          captured.direction,
        );
        return attachment ? [{ route, polyline, attachment }] : [];
      })
      .sort(
        (left, right) =>
          left.attachment.distanceSquared - right.attachment.distanceSquared ||
          left.route.id.localeCompare(right.route.id, "en"),
      )[0];
    if (!closest) continue;
    const annotation = draft.annotations.find(
      (candidate) => candidate.id === captured.annotationId,
    );
    if (!annotation || annotation.kind !== "route-marker") continue;
    const { segmentIndex, t } = closest.attachment;
    const from = closest.polyline.points[segmentIndex]!;
    const to = closest.polyline.points[segmentIndex + 1]!;
    const position = {
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
    };
    if (annotation.anchor?.kind === "route") {
      annotation.anchor = {
        ...annotation.anchor,
        routeId: closest.route.id,
        segmentIndex,
        t,
        fallbackPosition: position,
      };
    }
    if (annotation.routeAttachment) {
      annotation.routeAttachment = {
        ...annotation.routeAttachment,
        routeId: closest.route.id,
        segmentIndex,
        t,
      };
    }
    annotation.position = position;
    changedObjectIds.add(annotation.id);
  }
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
  const vertexIndex = polyline.points.findIndex(
    (point, index) =>
      index > 0 &&
      index < polyline.points.length - 1 &&
      point.x === position.x &&
      point.y === position.y,
  );
  const junctionEndpoint: RouteEndpoint = { kind: "junction", junctionId };
  if (vertexIndex > 0) {
    // A manual orthogonal bend is already a geometric vertex, not a point in
    // the interior of either adjoining segment. Splitting it through the
    // ordinary path would introduce a zero-length segment and is rejected by
    // route validation. Partition the existing polyline at the vertex instead.
    const firstNormalized = normalizeRouteGeometry(
      polyline.points.slice(0, vertexIndex + 1),
      route.segmentModes.slice(0, vertexIndex),
    );
    const secondNormalized = normalizeRouteGeometry(
      polyline.points.slice(vertexIndex),
      route.segmentModes.slice(vertexIndex),
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
  const segmentFrom = polyline.points[segmentIndex]!;
  const segmentTo = polyline.points[segmentIndex + 1]!;
  if (!pointOnSegment(position, segmentFrom, segmentTo)) {
    return `Junction position is not inside route segment ${segmentIndex}`;
  }
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

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function endpointBelongsToInstance(
  endpoint: RouteEndpoint,
  instanceId: string,
): boolean {
  return endpoint.kind === "terminal" && endpoint.instanceId === instanceId;
}

/**
 * Move one resolved terminal endpoint while preserving the axis of its
 * adjacent persisted segment. This changes geometry only; it never changes
 * Route topology or connectivity.
 */
function followRouteEndpoint(
  routeId: string,
  points: Point[],
  modes: RouteBranch["segmentModes"],
  side: "from" | "to",
  oldPoint: Point,
  newPoint: Point,
  outward: Point | null,
): void {
  if (samePoint(oldPoint, newPoint)) return;
  const mode = side === "from" ? modes[0] : modes.at(-1);
  if (mode === "locked" || mode === "trunk") {
    throw new Error(`Route ${routeId} has a protected adjacent segment`);
  }
  const endpointIndex = side === "from" ? 0 : points.length - 1;
  points[endpointIndex] = { ...newPoint };
  if (points.length === 2) return;

  const neighborIndex = side === "from" ? 1 : points.length - 2;
  const neighbor = points[neighborIndex]!;
  const oldNeighbor = { ...neighbor };
  if (mode === "escape" && outward) {
    const escapeLength =
      Math.abs(oldNeighbor.x - oldPoint.x) +
      Math.abs(oldNeighbor.y - oldPoint.y);
    neighbor.x = newPoint.x + outward.x * escapeLength;
    neighbor.y = newPoint.y + outward.y * escapeLength;

    const nextIndex = side === "from" ? neighborIndex + 1 : neighborIndex - 1;
    const next = points[nextIndex]!;
    if (neighbor.x !== next.x && neighbor.y !== next.y) {
      // Turn away from the rotated/mirrored escape before reconnecting to the
      // unchanged body. Choosing the perpendicular axis avoids a collinear
      // U-turn that normalization would collapse back toward the pin.
      const bridge =
        outward.x !== 0
          ? { x: neighbor.x, y: next.y }
          : { x: next.x, y: neighbor.y };
      const bridgeModeIndex = side === "from" ? 1 : modes.length - 2;
      const bridgeMode = modes[bridgeModeIndex] ?? "auto";
      points.splice(side === "from" ? nextIndex : neighborIndex, 0, bridge);
      modes.splice(bridgeModeIndex, 1, bridgeMode, bridgeMode);
    }
    return;
  }
  if (oldPoint.x === neighbor.x && oldPoint.y !== neighbor.y) {
    neighbor.x = newPoint.x;
  } else if (oldPoint.y === neighbor.y && oldPoint.x !== neighbor.x) {
    neighbor.y = newPoint.y;
  } else {
    throw new Error(`Route ${routeId} has invalid endpoint geometry`);
  }
}

/**
 * Apply topology-preserving Route geometry after any instance placement
 * transform. The caller supplies the pre-edit snapshot and the transformed
 * draft, making move/rotate/mirror share one behavior at the transaction
 * boundary.
 */
function applyInstanceRouteFollow(
  draft: SchematicDocument,
  originalDocument: SchematicDocument,
  resolver: SymbolResolver,
  instanceId: string,
): string[] {
  const changed: string[] = [];
  for (const originalRoute of originalDocument.routes) {
    const movesFrom = endpointBelongsToInstance(originalRoute.from, instanceId);
    const movesTo = endpointBelongsToInstance(originalRoute.to, instanceId);
    if (!movesFrom && !movesTo) continue;

    const route = draft.routes.find(
      (candidate) => candidate.id === originalRoute.id,
    );
    const original = routePolyline(originalDocument, resolver, originalRoute);
    const newFrom = route
      ? resolveEndpointPoint(draft, resolver, route.from)
      : null;
    const newTo = route
      ? resolveEndpointPoint(draft, resolver, route.to)
      : null;
    if (!route || !original || !newFrom || !newTo) continue;

    const points = original.points.map((point) => ({ ...point }));
    const modes = [...original.segmentModes];
    try {
      if (movesFrom) {
        followRouteEndpoint(
          route.id,
          points,
          modes,
          "from",
          original.points[0]!,
          newFrom,
          resolveEndpointOutwardDirection(draft, resolver, route.from),
        );
      }
      if (movesTo) {
        followRouteEndpoint(
          route.id,
          points,
          modes,
          "to",
          original.points.at(-1)!,
          newTo,
          resolveEndpointOutwardDirection(draft, resolver, route.to),
        );
      }
    } catch {
      // Preserve the established move+set_route_points escape hatch. A later
      // explicit edit may provide valid geometry; otherwise final validation
      // rejects this transaction and names the affected Route.
      continue;
    }

    if (points.length === 2 && newFrom.x !== newTo.x && newFrom.y !== newTo.y) {
      const originallyVertical =
        original.points[0]!.x === original.points[1]!.x;
      points.splice(
        1,
        0,
        originallyVertical
          ? { x: newFrom.x, y: newTo.y }
          : { x: newTo.x, y: newFrom.y },
      );
      const mode = modes[0] ?? "manual";
      modes.splice(0, 1, mode, mode);
    }

    const normalized = normalizeRouteGeometry(points, modes);
    if (!isOrthogonal(normalized.points)) continue;
    route.waypoints = normalized.points.slice(1, -1);
    route.segmentModes = normalized.segmentModes;
    changed.push(route.id);
  }
  return changed.sort((left, right) => left.localeCompare(right, "en"));
}

function translateAttachedAnnotation(
  annotation: Annotation,
  attachedObjectId: string,
  delta: Point,
): void {
  annotation.position = {
    x: annotation.position.x + delta.x,
    y: annotation.position.y + delta.y,
  };
  if (annotation.anchor?.kind === "free") {
    annotation.anchor.position = {
      x: annotation.anchor.position.x + delta.x,
      y: annotation.anchor.position.y + delta.y,
    };
  } else if (
    annotation.anchor?.kind === "object" &&
    annotation.anchor.objectId === attachedObjectId
  ) {
    annotation.anchor.fallbackPosition = {
      x: annotation.anchor.fallbackPosition.x + delta.x,
      y: annotation.anchor.fallbackPosition.y + delta.y,
    };
  }
}

function followAttachedAnnotations(
  draft: SchematicDocument,
  instanceId: string,
  oldPosition: Point,
  oldOrientation: Orientation,
  newPosition: Point,
  newOrientation: Orientation,
  changedObjectIds: Set<string>,
  resolver?: SymbolResolver,
): void {
  const isPureTranslation =
    oldOrientation.rotation === newOrientation.rotation &&
    oldOrientation.mirror === newOrientation.mirror;
  if (isPureTranslation) {
    const delta = {
      x: newPosition.x - oldPosition.x,
      y: newPosition.y - oldPosition.y,
    };
    for (const annotation of draft.annotations) {
      if (annotation.attachedObjectId !== instanceId) continue;
      translateAttachedAnnotation(annotation, instanceId, delta);
      changedObjectIds.add(annotation.id);
    }
    return;
  }

  const directionForRotation = (rotation: Rotation): Point => {
    switch (rotation) {
      case 0:
        return { x: 1, y: 0 };
      case 90:
        return { x: 0, y: 1 };
      case 180:
        return { x: -1, y: 0 };
      case 270:
        return { x: 0, y: -1 };
    }
  };
  const rotationForDirection = (direction: Point): Rotation => {
    if (direction.x > 0) return 0;
    if (direction.y > 0) return 90;
    if (direction.x < 0) return 180;
    return 270;
  };
  const origin = { x: 0, y: 0 };
  const instance = draft.instances.find(
    (candidate) => candidate.id === instanceId,
  );
  const resolved = instance
    ? resolver?.resolve(instance.symbolId, instance.symbolVariantId)
    : undefined;
  const definition = resolved?.definition;
  for (const annotation of draft.annotations) {
    if (annotation.attachedObjectId !== instanceId) continue;
    const hasRecordedOffset =
      annotation.offset.x !== 0 ||
      annotation.offset.y !== 0 ||
      (annotation.position.x === oldPosition.x &&
        annotation.position.y === oldPosition.y);
    const semanticAnchor = hasRecordedOffset
      ? {
          x: oldPosition.x + annotation.offset.x,
          y: oldPosition.y + annotation.offset.y,
        }
      : annotation.position;
    const local = inverseTransformPoint(
      semanticAnchor,
      oldPosition,
      oldOrientation,
    );
    const transformedAnchor = transformPoint(
      local,
      newPosition,
      newOrientation,
    );
    let position = transformedAnchor;
    let transformedSide: Point | null = null;
    let transformedAlignment: "start" | "middle" | "end" | null = null;
    if (annotation.kind === "instance-label" && definition) {
      if (instance && resolved && isMosSymbol(resolved)) {
        const localSide = inferInstanceLabelSide(
          local,
          visibleSymbolLocalBounds(resolved),
        );
        if (localSide) {
          try {
            const placement = placeUprightInstanceLabel(
              instance,
              resolved,
              resolveSchematicStyleProfile(draft.presentation.styleProfileId),
              local,
              localSide,
              annotation.sizeScale,
            );
            if (placement) {
              position = placement.position;
              transformedAlignment = placement.alignment;
            }
          } catch {
            // Keep the rigid semantic transform for a legacy/unknown profile;
            // formal rendering reports the invalid profile separately.
          }
        }
      } else {
        const box = definition.viewBox;
        const edges = {
          left: box.x,
          right: box.x + box.width,
          top: box.y,
          bottom: box.y + box.height,
        };
        const candidates = [
          ...(local.x < edges.left
            ? [{ side: { x: -1, y: 0 }, gap: edges.left - local.x }]
            : []),
          ...(local.x > edges.right
            ? [{ side: { x: 1, y: 0 }, gap: local.x - edges.right }]
            : []),
          ...(local.y < edges.top
            ? [{ side: { x: 0, y: -1 }, gap: edges.top - local.y }]
            : []),
          ...(local.y > edges.bottom
            ? [{ side: { x: 0, y: 1 }, gap: local.y - edges.bottom }]
            : []),
        ].sort((left, right) => left.gap - right.gap);
        const reference = candidates[0];
        if (reference) {
          const edgeSide = transformPoint(
            reference.side,
            origin,
            newOrientation,
          );
          transformedSide = edgeSide;
          const corners = [
            { x: edges.left, y: edges.top },
            { x: edges.right, y: edges.top },
            { x: edges.right, y: edges.bottom },
            { x: edges.left, y: edges.bottom },
          ].map((corner) =>
            transformPoint(corner, newPosition, newOrientation),
          );
          const bounds = {
            left: Math.min(...corners.map((corner) => corner.x)),
            right: Math.max(...corners.map((corner) => corner.x)),
            top: Math.min(...corners.map((corner) => corner.y)),
            bottom: Math.max(...corners.map((corner) => corner.y)),
          };
          let fontSize = 15.116 * (annotation.sizeScale ?? 1);
          try {
            fontSize =
              resolveSchematicStyleProfile(draft.presentation.styleProfileId)
                .typography.instanceFontSize * (annotation.sizeScale ?? 1);
          } catch {
            // Keep a deterministic typography fallback for a legacy/unknown
            // profile; formal rendering reports the invalid profile separately.
          }
          if (edgeSide.x > 0) {
            position = { x: bounds.right + reference.gap, y: position.y };
          } else if (edgeSide.x < 0) {
            position = { x: bounds.left - reference.gap, y: position.y };
          } else if (edgeSide.y > 0) {
            // SVG y is a baseline. Preserve the visual gap from the glyph top.
            position = {
              x: position.x,
              y: bounds.bottom + reference.gap + fontSize * 1.05,
            };
          } else {
            // Preserve the visual gap from the glyph bottom.
            position = {
              x: position.x,
              y: bounds.top - reference.gap - fontSize * 0.3,
            };
          }
        }
      }
    }
    annotation.position = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    annotation.offset = {
      x: transformedAnchor.x - newPosition.x,
      y: transformedAnchor.y - newPosition.y,
    };
    if (annotation.kind === "instance-label") {
      annotation.rotation = 0;
      annotation.alignment =
        transformedAlignment ??
        (transformedSide
          ? transformedSide.x > 0
            ? "start"
            : transformedSide.x < 0
              ? "end"
              : "middle"
          : "middle");
    } else {
      const oldDirection = directionForRotation(annotation.rotation);
      const localDirection = inverseTransformPoint(
        oldDirection,
        origin,
        oldOrientation,
      );
      annotation.rotation = rotationForDirection(
        transformPoint(localDirection, origin, newOrientation),
      );
    }
    changedObjectIds.add(annotation.id);
  }
}

/**
 * Ensure the ADR 0010 drafting layer exists on a draft Document. It is
 * optional in the schema so legacy Projects still validate; edits that touch
 * drafting initialize an empty container first.
 */
function ensureDraftingLayer(draft: SchematicDocument): void {
  if (!draft.drafting) {
    draft.drafting = { objects: [], guides: [] };
  }
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
      "Undo and redo require a Document History session",
    );
  }

  const proposedRevision = document.revision + 1;
  const draft = structuredClone(document);
  const changedObjectIds = new Set<string>();
  const resolver = context.symbolResolver;
  const originalRouteStates = new Map(
    resolver
      ? document.routes.map((route) => [
          route.id,
          {
            points: routePolyline(document, resolver, route)?.points ?? null,
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
          return rejectAt(
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
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
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
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance is still connected or referenced: ${edit.instanceId}`,
          );
        }
        draft.instances.splice(index, 1);
        changedObjectIds.add(edit.instanceId);
        connectivityChanged = true;
        break;
      }
      case "set_instance_symbol": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        const resolver = context.symbolResolver;
        if (!resolver) {
          return rejectAt(
            "EDIT_CONTEXT_REQUIRED",
            "Symbol edits require a Symbol Resolver",
          );
        }
        const symbolVariantId = edit.symbolVariantId ?? undefined;
        const resolved = resolver.resolve(edit.symbolId, symbolVariantId);
        if (!resolved) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Symbol or variant does not exist: ${edit.symbolId}${symbolVariantId ? `/${symbolVariantId}` : ""}`,
          );
        }
        const targetPins = new Set(
          resolved.definition.pins.map((pin) => pin.name),
        );
        const currentPins = new Set(
          draft.nets.flatMap((net) =>
            net.terminals
              .filter((terminal) => terminal.instanceId === edit.instanceId)
              .map((terminal) => terminal.pinName),
          ),
        );
        for (const route of draft.routes) {
          for (const endpoint of [route.from, route.to]) {
            if (
              endpoint.kind === "terminal" &&
              endpoint.instanceId === edit.instanceId
            ) {
              currentPins.add(endpoint.pinName);
            }
          }
        }
        const pinMap = edit.pinMap ?? {};
        for (const sourcePin of Object.keys(pinMap)) {
          if (!currentPins.has(sourcePin)) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Pin map source is not connected or routed: ${edit.instanceId}.${sourcePin}`,
            );
          }
        }
        const mappedPins = new Map<string, string>();
        for (const sourcePin of currentPins) {
          const targetPin = pinMap[sourcePin] ?? sourcePin;
          if (!targetPins.has(targetPin)) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Target symbol pin does not exist: ${edit.instanceId}.${targetPin}`,
            );
          }
          const previousSource = mappedPins.get(targetPin);
          if (previousSource && previousSource !== sourcePin) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Pin map aliases ${previousSource} and ${sourcePin} to ${targetPin}`,
            );
          }
          mappedPins.set(targetPin, sourcePin);
        }
        for (const net of draft.nets) {
          let changed = false;
          for (const terminal of net.terminals) {
            if (terminal.instanceId !== edit.instanceId) continue;
            terminal.pinName = pinMap[terminal.pinName] ?? terminal.pinName;
            changed = true;
          }
          if (changed) changedObjectIds.add(net.id);
        }
        for (const route of draft.routes) {
          let changed = false;
          for (const endpoint of [route.from, route.to]) {
            if (
              endpoint.kind === "terminal" &&
              endpoint.instanceId === edit.instanceId
            ) {
              endpoint.pinName = pinMap[endpoint.pinName] ?? endpoint.pinName;
              changed = true;
            }
          }
          if (changed) changedObjectIds.add(route.id);
        }
        for (const [key, value] of Object.entries(instance.properties)) {
          if (!key.startsWith("spice.pin.") || typeof value !== "string")
            continue;
          instance.properties[key] = pinMap[value] ?? value;
        }
        instance.symbolId = edit.symbolId;
        if (symbolVariantId === undefined) delete instance.symbolVariantId;
        else instance.symbolVariantId = symbolVariantId;
        changedObjectIds.add(instance.id);
        break;
      }
      case "place_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
          );
        }
        if (instance.placement !== null) {
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        const beforeTransform = structuredClone(draft);
        const oldPlacement = structuredClone(instance.placement);
        instance.placement.position = structuredClone(edit.position);
        followAttachedAnnotations(
          draft,
          edit.instanceId,
          oldPlacement.position,
          oldPlacement,
          instance.placement.position,
          instance.placement,
          changedObjectIds,
          context.symbolResolver,
        );
        // Use the snapshot taken immediately before this edit. This is still
        // progressive for multi-edit transactions, but unlike the old path it
        // retains the terminal's actual pre-move coordinates.
        const resolver = context.symbolResolver;
        if (resolver) {
          const stretched = applyInstanceRouteFollow(
            draft,
            beforeTransform,
            resolver,
            edit.instanceId,
          );
          for (const routeId of stretched) changedObjectIds.add(routeId);
        }
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "rotate_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        const beforeTransform = structuredClone(draft);
        const oldPlacement = structuredClone(instance.placement);
        instance.placement.rotation = edit.rotation;
        followAttachedAnnotations(
          draft,
          edit.instanceId,
          oldPlacement.position,
          oldPlacement,
          instance.placement.position,
          instance.placement,
          changedObjectIds,
          context.symbolResolver,
        );
        const rotateResolver = context.symbolResolver;
        if (rotateResolver) {
          for (const routeId of applyInstanceRouteFollow(
            draft,
            beforeTransform,
            rotateResolver,
            edit.instanceId,
          )) {
            changedObjectIds.add(routeId);
          }
        }
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "mirror_instance": {
        const instance = draft.instances.find(
          (candidate) => candidate.id === edit.instanceId,
        );
        if (!instance) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${edit.instanceId}`,
            [],
            [edit.instanceId],
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (instance.placement === null) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          );
        }
        const beforeTransform = structuredClone(draft);
        const oldPlacement = structuredClone(instance.placement);
        instance.placement.mirror = edit.mirror;
        followAttachedAnnotations(
          draft,
          edit.instanceId,
          oldPlacement.position,
          oldPlacement,
          instance.placement.position,
          instance.placement,
          changedObjectIds,
          context.symbolResolver,
        );
        const mirrorResolver = context.symbolResolver;
        if (mirrorResolver) {
          for (const routeId of applyInstanceRouteFollow(
            draft,
            beforeTransform,
            mirrorResolver,
            edit.instanceId,
          )) {
            changedObjectIds.add(routeId);
          }
        }
        changedObjectIds.add(edit.instanceId);
        break;
      }
      case "place_port": {
        const port = draft.ports.find(
          (candidate) => candidate.id === edit.portId,
        );
        if (!port) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Port does not exist: ${edit.portId}`,
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.portId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Port ${edit.portId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (port.position !== null) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Port is already placed: ${edit.portId}`,
          );
        }
        port.position = structuredClone(edit.position);
        changedObjectIds.add(port.id);
        break;
      }
      case "move_port": {
        const port = draft.ports.find(
          (candidate) => candidate.id === edit.portId,
        );
        if (!port) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Port does not exist: ${edit.portId}`,
          );
        }
        const lockOwner = lockedLayoutOwner(draft, edit.portId);
        if (lockOwner) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Port ${edit.portId} is locked by layout intent ${lockOwner}`,
          );
        }
        if (port.position === null) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Port is not placed: ${edit.portId}`,
          );
        }
        const delta = {
          x: edit.position.x - port.position.x,
          y: edit.position.y - port.position.y,
        };
        port.position = structuredClone(edit.position);
        for (const annotation of draft.annotations) {
          if (annotation.attachedObjectId === edit.portId) {
            translateAttachedAnnotation(annotation, edit.portId, delta);
            changedObjectIds.add(annotation.id);
          }
        }
        changedObjectIds.add(port.id);
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
        const routeError = validateRoute(draft, route, resolver);
        if (routeError) {
          return rejectAt("EDIT_PRECONDITION", routeError, [], [edit.routeId]);
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
        const fromPoint = resolveEndpointPoint(draft, resolver, edit.from);
        const toPoint = resolveEndpointPoint(draft, resolver, edit.to);
        if (!fromPoint || !toPoint) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Route ${edit.routeId} has an unresolved endpoint`,
            [],
            [edit.routeId],
          );
        }
        const geometry = buildOrthogonalEscapeRoute(
          {
            point: fromPoint,
            outward: resolveEndpointOutwardDirection(
              draft,
              resolver,
              edit.from,
            ),
          },
          {
            point: toPoint,
            outward: resolveEndpointOutwardDirection(draft, resolver, edit.to),
          },
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
        };
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
            scope: "local",
            terminals: [],
            ports: [],
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
            edit.junctionId,
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
          return rejectAt(
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
          return rejectAt(
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
        draft.routes.splice(routeIndex, 1);
        changedObjectIds.add(edit.routeId);
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
        const net = draft.nets.find(
          (candidate) => candidate.id === route.netId,
        );
        if (!net) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Route Net does not exist: ${route.netId}`,
          );
        }
        const beforeGroups = netEndpointGroups(draft, net.id);
        if (beforeGroups.length > 1) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Cannot cut ${route.id}: Net ${net.id} still has unrouted members; disconnect a pin explicitly`,
            [],
            [route.id, net.id],
          );
        }

        const candidateOrphanJunctionIds = new Set(
          [route.from, route.to].flatMap((endpoint) =>
            endpoint.kind === "junction" ? [endpoint.junctionId] : [],
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
            annotation.attachedObjectId ? [annotation.attachedObjectId] : [],
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
        draft.junctions = draft.junctions.filter(
          (junction) => !removedJunctionIds.includes(junction.id),
        );
        for (const junctionId of removedJunctionIds) {
          changedObjectIds.add(junctionId);
        }

        const groups = netEndpointGroups(draft, net.id);
        if (groups.length === 0 && net.scope === "local") {
          draft.nets = draft.nets.filter(
            (candidate) => candidate.id !== net.id,
          );
          changedObjectIds.add(net.id);
          connectivityChanged = true;
          break;
        }
        if (groups.length > 1 && net.scope === "global") {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Cannot split global Net ${net.id}; disconnect a pin explicitly`,
            [],
            [route.id, net.id],
          );
        }
        if (groups.length > 1) {
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
          const originalTerminals = [...net.terminals];
          const originalPorts = [...net.ports];
          const terminalsFor = (groupNetId: string) =>
            originalTerminals.filter(
              (terminal) =>
                netIdByEndpoint.get(
                  endpointKey({ kind: "terminal", ...terminal }),
                ) === groupNetId,
            );
          const portsFor = (groupNetId: string) =>
            originalPorts.filter(
              (portId) =>
                netIdByEndpoint.get(endpointKey({ kind: "port", portId })) ===
                groupNetId,
            );
          net.terminals = terminalsFor(net.id);
          net.ports = portsFor(net.id);
          changedObjectIds.add(net.id);
          for (const group of groups.slice(1)) {
            const groupNetId = netIdByEndpoint.get(group[0]!)!;
            draft.nets.push({
              id: groupNetId,
              scope: "local",
              terminals: terminalsFor(groupNetId),
              ports: portsFor(groupNetId),
            });
            changedObjectIds.add(groupNetId);
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
          return rejectAt(
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
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Net does not exist: ${edit.netId}`,
          );
        }
        const conflicting = draft.nets.find(
          (candidate) =>
            candidate.id !== net.id && candidate.name === edit.name,
        );
        if (conflicting) {
          return rejectAt(
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
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Annotation does not exist: ${edit.annotationId}`,
          );
        }
        if (annotation.locked) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Annotation is locked: ${annotation.id}`,
          );
        }
        if (
          [...draft.layoutGroups, ...draft.constraints].some((item) =>
            item.objectIds.includes(annotation.id),
          )
        ) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Annotation is referenced by layout intent: ${annotation.id}`,
          );
        }
        draft.annotations.splice(index, 1);
        changedObjectIds.add(annotation.id);
        break;
      }
      case "set_presentation_style": {
        draft.presentation.styleProfileId = edit.styleProfileId;
        changedObjectIds.add(draft.id);
        break;
      }
      case "upsert_schematic_annotation": {
        const existingIndex = draft.annotations.findIndex(
          (annotation) => annotation.id === edit.annotation.id,
        );
        const existing = draft.annotations[existingIndex];
        if (existing?.locked) {
          return rejectAt(
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
      case "remove_schematic_annotation": {
        const index = draft.annotations.findIndex(
          (annotation) => annotation.id === edit.annotationId,
        );
        const annotation = draft.annotations[index];
        if (!annotation) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Annotation does not exist: ${edit.annotationId}`,
          );
        }
        if (annotation.locked) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Annotation is locked: ${annotation.id}`,
          );
        }
        draft.annotations.splice(index, 1);
        changedObjectIds.add(annotation.id);
        break;
      }
      case "upsert_drafting_object": {
        ensureDraftingLayer(draft);
        const objects = draft.drafting!.objects;
        const existingIndex = objects.findIndex(
          (item) => item.id === edit.object.id,
        );
        const existing = objects[existingIndex];
        const parsed = DraftingObjectSchema.parse(edit.object);
        // Locking protects the object from normal replacement, but it must not
        // become irreversible. Permit exactly one exceptional replacement: the
        // same canonical object with only `locked` switched to false. Parsing
        // both sides through the model schema gives this comparison a stable
        // persisted shape and prevents Unlock from smuggling in another edit.
        const isPureUnlock =
          existing?.locked === true &&
          parsed.locked === false &&
          JSON.stringify({ ...existing, locked: false }) ===
            JSON.stringify(parsed);
        if (existing?.locked && !isPureUnlock) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Drafting object is locked: ${existing.id}`,
          );
        }
        if (parsed.kind === "floating-symbol") {
          if (!resolver) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `A Symbol Resolver is required to validate a floating symbol: ${parsed.symbolId}`,
            );
          }
          const resolved = resolver.resolve(parsed.symbolId);
          if (!resolved) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Unknown floating symbol: ${parsed.symbolId}`,
            );
          }
          // ADR 0010: a floating symbol must reference a `decorative: true`
          // catalog entry whose definition contains no terminal, enforced here
          // via the Symbol Resolver (the model schema cannot check the catalog).
          if (!resolved.definition.decorative) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Floating symbol must be decorative: ${parsed.symbolId}`,
            );
          }
          if (resolved.definition.pins.length > 0) {
            return rejectAt(
              "EDIT_PRECONDITION",
              `Floating symbol must be terminal-free: ${parsed.symbolId}`,
            );
          }
        }
        if (existingIndex >= 0) objects[existingIndex] = parsed;
        else objects.push(parsed);
        changedObjectIds.add(parsed.id);
        break;
      }
      case "remove_drafting_object": {
        ensureDraftingLayer(draft);
        const objects = draft.drafting!.objects;
        const index = objects.findIndex((item) => item.id === edit.objectId);
        const object = objects[index];
        if (!object) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Drafting object does not exist: ${edit.objectId}`,
          );
        }
        objects.splice(index, 1);
        changedObjectIds.add(object.id);
        break;
      }
      case "set_guide": {
        ensureDraftingLayer(draft);
        const guides = draft.drafting!.guides;
        const parsed = GuideSchema.parse(edit.guide);
        const existingIndex = guides.findIndex((item) => item.id === parsed.id);
        const existing = guides[existingIndex];
        if (existing?.locked) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Guide is locked: ${existing.id}`,
          );
        }
        if (existingIndex >= 0) guides[existingIndex] = parsed;
        else guides.push(parsed);
        changedObjectIds.add(parsed.id);
        break;
      }
      case "remove_guide": {
        ensureDraftingLayer(draft);
        const guides = draft.drafting!.guides;
        const index = guides.findIndex((item) => item.id === edit.guideId);
        const guide = guides[index];
        if (!guide) {
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Guide does not exist: ${edit.guideId}`,
          );
        }
        if (guide.locked) {
          return rejectAt("EDIT_PRECONDITION", `Guide is locked: ${guide.id}`);
        }
        guides.splice(index, 1);
        changedObjectIds.add(guide.id);
        break;
      }
      case "set_layout_group": {
        const index = draft.layoutGroups.findIndex(
          (group) => group.id === edit.group.id,
        );
        const existing = draft.layoutGroups[index];
        if (existing?.locked) {
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Layout group does not exist: ${edit.groupId}`,
          );
        }
        if (group.locked) {
          return rejectAt(
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
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Layout constraint does not exist: ${edit.constraintId}`,
          );
        }
        if (constraint.locked) {
          return rejectAt(
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
          return rejectAt(
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
          return rejectAt(
            "OBJECT_NOT_FOUND",
            `Instance does not exist: ${missing}`,
          );
        }
        const lockedInstanceId = edit.instanceIds.find((id) =>
          lockedLayoutOwner(draft, id),
        );
        if (lockedInstanceId) {
          return rejectAt(
            "EDIT_PRECONDITION",
            `Instance ${lockedInstanceId} is locked by layout intent ${lockedLayoutOwner(draft, lockedInstanceId)}`,
          );
        }
        if (instances.some((instance) => instance!.placement === null)) {
          return rejectAt(
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
              translateAttachedAnnotation(annotation, instance!.id, {
                x: edit.axis === "x" ? coordinate - oldCoordinate : 0,
                y: edit.axis === "y" ? coordinate - oldCoordinate : 0,
              });
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

  if (resolver) {
    for (const route of draft.routes) {
      const routeError = validateRoute(draft, route, resolver);
      const original = originalRouteStates.get(route.id);
      const resolvedPoints =
        routePolyline(draft, resolver, route)?.points ?? null;
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
