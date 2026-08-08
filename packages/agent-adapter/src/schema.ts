import {
  AnnotationSchema,
  DraftingDiagnosticSchema,
  DraftingObjectSchema,
  LayoutConstraintSchema,
  LayoutGroupSchema,
  JunctionRoleSchema,
  PlacementSchema,
  PointSchema,
  ResolvedDraftingGeometrySchema,
  PresentationIntentSchema,
  RectSchema,
  RouteEndpointSchema,
  SegmentModeSchema,
  SourceSpanSchema,
  StableIdSchema,
} from "@icm/model";
import { SchematicEditSchema } from "@icm/edit-engine";
import { z } from "zod";

export const AGENT_API_V1_VERSION = "1.0" as const;
export const AGENT_API_VERSION = "2.0" as const;
export const AGENT_SNAPSHOT_VERSION = "1.0" as const;
export const AgentApiVersionSchema = z.enum([
  AGENT_API_V1_VERSION,
  AGENT_API_VERSION,
]);

const RequestBaseSchema = z.strictObject({
  apiVersion: AgentApiVersionSchema,
  requestId: StableIdSchema,
});

export const AgentPermissionsSchema = z.strictObject({
  query: z.boolean(),
  snapshot: z.boolean().optional(),
  render: z.boolean(),
  sourceSpans: z.boolean(),
  edit: z.strictObject({
    geometry: z.boolean(),
    connectivity: z.boolean(),
    presentation: z.boolean(),
  }),
});

export const AgentLimitsSchema = z.strictObject({
  maxQueryObjects: z.number().int().positive().max(1000),
  maxQueryBytes: z.number().int().positive().max(10_000_000),
  maxSnapshotBytes: z.number().int().positive().max(20_000_000),
  maxTransactionEdits: z.number().int().positive().max(256),
  maxRenderBytes: z.number().int().positive().max(20_000_000),
  maxRequestBytes: z.number().int().positive().max(2_000_000),
  changeHistoryEntries: z.number().int().positive().max(256),
});

export const QueryScopeKindSchema = z.enum([
  "summary",
  "selection",
  "objects",
  "region",
  "net",
  "constraints",
  "diagnostics",
  "changes",
]);

export const QueryScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("summary") }),
  z.strictObject({
    kind: z.literal("selection"),
    objectIds: z.array(StableIdSchema).min(1).max(200),
  }),
  z.strictObject({
    kind: z.literal("objects"),
    objectIds: z.array(StableIdSchema).min(1).max(200),
  }),
  z.strictObject({ kind: z.literal("region"), bounds: RectSchema }),
  z.strictObject({ kind: z.literal("net"), netId: StableIdSchema }),
  z.strictObject({ kind: z.literal("constraints") }),
  z.strictObject({ kind: z.literal("diagnostics") }),
  z.strictObject({
    kind: z.literal("changes"),
    sinceRevision: z.number().int().nonnegative(),
  }),
]);

export const AgentCapabilitiesRequestSchema = RequestBaseSchema.extend({
  operation: z.literal("capabilities"),
});
export const AgentQueryRequestSchema = RequestBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_V1_VERSION),
  operation: z.literal("query"),
  documentId: StableIdSchema,
  scope: QueryScopeSchema,
  limit: z.number().int().positive().max(1000).optional(),
  includeSourceSpans: z.boolean().optional(),
});
export const AgentSnapshotRequestSchema = RequestBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_VERSION),
  operation: z.literal("snapshot"),
  documentId: StableIdSchema,
  includeSourceSpans: z.boolean().optional(),
  // ADR 0010 WP-R4: include guide axis/coordinate in the response. Default
  // false so editor noise is not mistaken for circuit content.
  includeEditorGuides: z.boolean().optional(),
});
export const AgentTransactRequestSchema = RequestBaseSchema.extend({
  operation: z.literal("transact"),
  documentId: StableIdSchema,
  transactionId: StableIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  dryRun: z.boolean().optional(),
  edits: z.array(SchematicEditSchema).min(1).max(256),
});
export const AgentRenderRequestSchema = RequestBaseSchema.extend({
  operation: z.literal("render"),
  documentId: StableIdSchema,
  mode: z.enum(["formal", "diagnostics"]),
  bounds: RectSchema.optional(),
});

export const AgentCircuitRequestSchema = z.discriminatedUnion("operation", [
  AgentCapabilitiesRequestSchema,
  AgentQueryRequestSchema,
  AgentSnapshotRequestSchema,
  AgentTransactRequestSchema,
  AgentRenderRequestSchema,
]);

export const AgentDiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  objectIds: z.array(StableIdSchema).optional(),
  path: z.array(z.union([z.string(), z.number().int()])).optional(),
  revision: z.number().int().nonnegative().optional(),
  bounds: RectSchema.optional(),
  point: PointSchema.optional(),
  parameters: z
    .record(
      z.string(),
      z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    )
    .optional(),
});
export const AgentDiffSchema = z.strictObject({
  documentId: StableIdSchema,
  fromRevision: z.number().int().nonnegative(),
  toRevision: z.number().int().nonnegative(),
  editKinds: z.array(z.string().min(1)),
  changedObjectIds: z.array(StableIdSchema),
});
export const AgentObjectDescriptorSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "port",
    "instance",
    "net",
    "route",
    "junction",
    "annotation",
    "layout-group",
    "constraint",
  ]),
  name: z.string().optional(),
  position: z
    .strictObject({ x: z.number().int(), y: z.number().int() })
    .optional(),
  bounds: RectSchema.optional(),
  netIds: z.array(StableIdSchema),
  attributes: z.record(
    z.string(),
    z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
  ),
  sourceRef: SourceSpanSchema.optional(),
});

const SnapshotPrimitiveSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

export const AgentSnapshotPinSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string().min(1).nullable(),
  direction: z.enum(["north", "east", "south", "west"]).nullable(),
  visibility: z.enum(["visible", "implicit", "conditional", "unknown"]),
  localPosition: PointSchema.nullable(),
  pagePosition: PointSchema.nullable(),
  netId: StableIdSchema.nullable(),
});

export const AgentSnapshotPortSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  direction: z.enum(["input", "output", "bidirectional", "passive"]),
  position: PointSchema.nullable(),
  netId: StableIdSchema.nullable(),
});

export const AgentSnapshotInstanceSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  symbolId: StableIdSchema,
  symbolVariantId: StableIdSchema.nullable(),
  target: z.string().nullable(),
  model: z.string().nullable(),
  properties: z.record(z.string(), SnapshotPrimitiveSchema),
  parameters: z.record(z.string(), SnapshotPrimitiveSchema),
  placement: PlacementSchema.nullable(),
  bounds: RectSchema.nullable(),
  pins: z.array(AgentSnapshotPinSchema),
  sourceRef: SourceSpanSchema.optional(),
});

export const AgentSnapshotNetSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1).nullable(),
  scope: z.enum(["local", "global"]),
  terminals: z.array(
    z.strictObject({
      instanceId: StableIdSchema,
      pinName: z.string().min(1),
    }),
  ),
  portIds: z.array(StableIdSchema),
  routeIds: z.array(StableIdSchema),
  junctionIds: z.array(StableIdSchema),
});

export const AgentSnapshotRouteSchema = z.strictObject({
  id: StableIdSchema,
  netId: StableIdSchema,
  from: RouteEndpointSchema,
  to: RouteEndpointSchema,
  waypoints: z.array(PointSchema),
  segmentModes: z.array(SegmentModeSchema),
  polyline: z.array(PointSchema).min(2).nullable(),
});

export const AgentSnapshotJunctionSchema = z.strictObject({
  id: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
  role: JunctionRoleSchema.optional(),
});

export const AgentSnapshotDocumentSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  sourceStatus: z.enum([
    "in-sync",
    "geometry-only-changed",
    "connectivity-modified",
  ]),
  sourceBinding: z
    .strictObject({
      cellName: z.string().min(1),
      sourceRef: SourceSpanSchema.optional(),
    })
    .optional(),
  bounds: RectSchema.nullable(),
  presentation: PresentationIntentSchema,
  ports: z.array(AgentSnapshotPortSchema),
  instances: z.array(AgentSnapshotInstanceSchema),
  nets: z.array(AgentSnapshotNetSchema),
  routes: z.array(AgentSnapshotRouteSchema),
  junctions: z.array(AgentSnapshotJunctionSchema),
  annotations: z.array(AnnotationSchema),
  // ADR 0010 WP-R4: each drafting object carries its canonical shape plus the
  // derived resolved geometry (position(s)/bounds/diagnostics) computed from
  // the single resolveDraftingObjectGeometry entry. Guides expose
  // id/visible/locked by default; axis/coordinate are included only when the
  // request sets includeEditorGuides.
  drafting: z.strictObject({
    objects: z.array(
      z.strictObject({
        object: DraftingObjectSchema,
        // P1: strict typed contract — no z.unknown. The derived geometry and
        // its diagnostics are validated by the shared model schemas; the entry
        // carries only resolvedGeometry (which includes bounds), not a
        // duplicate top-level bounds.
        resolvedGeometry: ResolvedDraftingGeometrySchema,
        diagnostics: z.array(DraftingDiagnosticSchema),
      }),
    ),
    guides: z.array(
      z.strictObject({
        id: StableIdSchema,
        visible: z.boolean(),
        locked: z.boolean(),
        axis: z.enum(["horizontal", "vertical"]).optional(),
        coordinate: z.number().optional(),
      }),
    ),
  }),
  layoutGroups: z.array(LayoutGroupSchema),
  constraints: z.array(LayoutConstraintSchema),
  diagnostics: z.array(AgentDiagnosticSchema),
});

export const AgentProjectIndexDocumentSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  instanceCount: z.number().int().nonnegative(),
  portCount: z.number().int().nonnegative(),
  netCount: z.number().int().nonnegative(),
  references: z.array(
    z.strictObject({
      instanceId: StableIdSchema,
      targetName: z.string().min(1),
      targetDocumentId: StableIdSchema.nullable(),
    }),
  ),
});

export const AgentSessionSnapshotSchema = z.strictObject({
  snapshotVersion: z.literal(AGENT_SNAPSHOT_VERSION),
  electricalTopologyHash: z.string().regex(/^[a-f0-9]{64}$/u),
  byteLength: z.number().int().nonnegative(),
  project: z.strictObject({
    id: StableIdSchema,
    name: z.string().min(1),
    topDocumentId: StableIdSchema,
    documents: z.array(AgentProjectIndexDocumentSchema).min(1),
  }),
  document: AgentSnapshotDocumentSchema,
});

const ResponseBaseSchema = z.strictObject({
  apiVersion: AgentApiVersionSchema,
  requestId: StableIdSchema,
});
export const AgentCapabilitiesResponseSchema = ResponseBaseSchema.extend({
  operation: z.literal("capabilities"),
  ok: z.literal(true),
  capabilities: z.strictObject({
    apiVersions: z.tuple([
      z.literal(AGENT_API_V1_VERSION),
      z.literal(AGENT_API_VERSION),
    ]),
    snapshotVersions: z.tuple([z.literal(AGENT_SNAPSHOT_VERSION)]),
    operations: z.array(
      z.enum(["capabilities", "query", "snapshot", "transact", "render"]),
    ),
    queryScopes: z.array(QueryScopeKindSchema),
    editKinds: z.array(z.string().min(1)),
    permissions: AgentPermissionsSchema,
    limits: AgentLimitsSchema,
  }),
});
export const AgentQueryResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_V1_VERSION),
  operation: z.literal("query"),
  ok: z.literal(true),
  revision: z.number().int().nonnegative(),
  summary: z
    .strictObject({
      name: z.string(),
      styleProfileId: StableIdSchema,
      counts: z.record(z.string(), z.number().int().nonnegative()),
    })
    .optional(),
  objects: z.array(AgentObjectDescriptorSchema),
  changes: z.array(AgentDiffSchema).optional(),
  diagnostics: z.array(AgentDiagnosticSchema),
  truncated: z.boolean(),
  omittedCount: z.number().int().nonnegative(),
});
export const AgentSnapshotResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_VERSION),
  operation: z.literal("snapshot"),
  ok: z.literal(true),
  revision: z.number().int().nonnegative(),
  snapshot: AgentSessionSnapshotSchema,
  diagnostics: z.array(AgentDiagnosticSchema),
});
export const AgentTransactSuccessResponseSchema = ResponseBaseSchema.extend({
  operation: z.literal("transact"),
  ok: z.literal(true),
  applied: z.boolean(),
  revision: z.number().int().nonnegative(),
  proposedRevision: z.number().int().nonnegative(),
  diff: AgentDiffSchema,
  diagnostics: z.array(AgentDiagnosticSchema),
  resolvedRoutes: z
    .array(
      z.strictObject({
        routeId: StableIdSchema,
        polyline: z.array(PointSchema).min(2),
      }),
    )
    .optional(),
});
export const AgentRenderResponseSchema = ResponseBaseSchema.extend({
  operation: z.literal("render"),
  ok: z.literal(true),
  revision: z.number().int().nonnegative(),
  artifact: z.strictObject({
    mediaType: z.literal("image/svg+xml"),
    encoding: z.literal("base64"),
    data: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    byteLength: z.number().int().nonnegative(),
    mode: z.enum(["formal", "diagnostics"]),
  }),
  diagnostics: z.array(AgentDiagnosticSchema),
});
export const AgentErrorResponseSchema = ResponseBaseSchema.extend({
  operation: z.enum(["error", "query", "snapshot", "transact", "render"]),
  ok: z.literal(false),
  revision: z.number().int().nonnegative().optional(),
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string(),
  }),
  diagnostics: z.array(AgentDiagnosticSchema),
});

export const AgentCircuitResponseSchema = z.union([
  AgentCapabilitiesResponseSchema,
  AgentQueryResponseSchema,
  AgentSnapshotResponseSchema,
  AgentTransactSuccessResponseSchema,
  AgentRenderResponseSchema,
  AgentErrorResponseSchema,
]);

export const AgentCircuitRequestJsonSchema = z.toJSONSchema(
  AgentCircuitRequestSchema,
  { target: "draft-2020-12" },
);
export const AgentCircuitResponseJsonSchema = z.toJSONSchema(
  AgentCircuitResponseSchema,
  { target: "draft-2020-12" },
);

export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
export type AgentLimits = z.infer<typeof AgentLimitsSchema>;
export type AgentCircuitRequest = z.infer<typeof AgentCircuitRequestSchema>;
export type AgentCapabilitiesRequest = z.infer<
  typeof AgentCapabilitiesRequestSchema
>;
export type AgentQueryRequest = z.infer<typeof AgentQueryRequestSchema>;
export type AgentSnapshotRequest = z.infer<typeof AgentSnapshotRequestSchema>;
export type AgentTransactRequest = z.infer<typeof AgentTransactRequestSchema>;
export type AgentRenderRequest = z.infer<typeof AgentRenderRequestSchema>;
export type AgentCircuitResponse = z.infer<typeof AgentCircuitResponseSchema>;
export type AgentObjectDescriptor = z.infer<typeof AgentObjectDescriptorSchema>;
export type AgentDiagnostic = z.infer<typeof AgentDiagnosticSchema>;
export type AgentDiff = z.infer<typeof AgentDiffSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;
export type AgentSnapshotDocument = z.infer<typeof AgentSnapshotDocumentSchema>;
