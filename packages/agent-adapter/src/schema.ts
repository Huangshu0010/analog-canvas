import {
  AnnotationSchema,
  DraftingDiagnosticSchema,
  DraftingObjectSchema,
  LayoutConstraintSchema,
  LayoutGroupSchema,
  JunctionRoleSchema,
  NoConnectSchema,
  NetPowerDomainSchema,
  PlacementSchema,
  PointSchema,
  ResolvedDraftingGeometrySchema,
  PresentationIntentSchema,
  RectSchema,
  RouteEndpointSchema,
  RoutePresentationSchema,
  SegmentModeSchema,
  SourceSpanSchema,
  StableIdSchema,
} from "@icm/model";
import { SchematicEditSchema } from "@icm/edit-engine";
import { z } from "zod";

export const AGENT_API_V1_VERSION = "1.0" as const;
export const AGENT_API_VERSION = "2.0" as const;
export const AGENT_API_V3_VERSION = "3.0" as const;
export const AGENT_SNAPSHOT_VERSION = "1.0" as const;
export const AGENT_SNAPSHOT_V3_VERSION = "2.0" as const;
export const AgentApiVersionSchema = z.enum([
  AGENT_API_V1_VERSION,
  AGENT_API_VERSION,
  AGENT_API_V3_VERSION,
]);
export const AgentSnapshotTargetSchema = z.enum([
  "document",
  "project",
  "catalog",
]);

const RequestBaseSchema = z.strictObject({
  apiVersion: AgentApiVersionSchema,
  requestId: StableIdSchema,
});
const ProductionRequestBaseSchema = z.strictObject({
  apiVersion: z.literal(AGENT_API_VERSION),
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
const AgentProductionPermissionsSchema = AgentPermissionsSchema.omit({
  query: true,
}).extend({ snapshot: z.boolean() });
const AgentProductionLimitsSchema = AgentLimitsSchema.omit({
  maxQueryObjects: true,
  maxQueryBytes: true,
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
  apiVersion: z.enum([AGENT_API_VERSION, AGENT_API_V3_VERSION]),
  operation: z.literal("snapshot"),
  target: AgentSnapshotTargetSchema.optional(),
  documentId: StableIdSchema.optional(),
  includeSourceSpans: z.boolean().optional(),
}).superRefine((request, context) => {
  if (request.apiVersion === AGENT_API_V3_VERSION) {
    if (request.target === undefined) {
      context.addIssue({
        code: "custom",
        message: "v3 snapshot requires a target",
        path: ["target"],
      });
    }
  } else if (request.target !== undefined) {
    context.addIssue({
      code: "custom",
      message: "target is only valid for v3 snapshots",
      path: ["target"],
    });
  }
  const documentTarget =
    request.target === undefined || request.target === "document";
  if (documentTarget && request.documentId === undefined) {
    context.addIssue({
      code: "custom",
      message: "documentId is required for document snapshots",
      path: ["documentId"],
    });
  }
});
export const AgentWireIntentAnchorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("endpoint"),
    endpoint: RouteEndpointSchema,
  }),
  z.strictObject({
    kind: z.literal("route-segment"),
    routeId: StableIdSchema,
    segmentIndex: z.number().int().nonnegative(),
    point: PointSchema,
  }),
  z.strictObject({ kind: z.literal("free"), point: PointSchema }),
]);
export const AgentWireIntentSchema = z.strictObject({
  id: StableIdSchema,
  from: AgentWireIntentAnchorSchema,
  to: AgentWireIntentAnchorSchema,
  waypoints: z.array(PointSchema).max(256).optional(),
});

/**
 * New Agent writes use the current authoring contract even while the persisted
 * Project reader still accepts migration-only legacy shapes. This boundary is
 * intentionally narrower than `SchematicEditSchema`: compatibility belongs in
 * Project migration, not in newly-authored API payloads.
 */
export const AgentSchematicEditSchema = SchematicEditSchema.superRefine(
  (edit, context) => {
    if (edit.kind === "add_instance") {
      if (
        edit.instance.symbolId === "vdd" ||
        edit.instance.symbolId === "port" ||
        edit.instance.symbolId === "port-filled"
      ) {
        context.addIssue({
          code: "custom",
          path: ["instance", "symbolId"],
          message:
            edit.instance.symbolId === "vdd"
              ? "Use add_power_rail instead of the legacy vdd symbol"
              : "Use add_port instead of a legacy port symbol",
        });
      }
    }

    if (
      edit.kind === "set_instance_symbol" &&
      (edit.symbolId === "vdd" ||
        edit.symbolId === "port" ||
        edit.symbolId === "port-filled")
    ) {
      context.addIssue({
        code: "custom",
        path: ["symbolId"],
        message:
          edit.symbolId === "vdd"
            ? "Use add_power_rail instead of the legacy vdd symbol"
            : "Use add_port instead of a legacy port symbol",
      });
    }

    if (
      edit.kind === "set_presentation_style" &&
      edit.styleProfileId === "textbook-monochrome-v1"
    ) {
      context.addIssue({
        code: "custom",
        path: ["styleProfileId"],
        message: "Use the current Razavi product style profile",
      });
    }
  },
);
export const AgentTransactRequestSchema = RequestBaseSchema.extend({
  operation: z.literal("transact"),
  documentId: StableIdSchema,
  transactionId: StableIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  dryRun: z.boolean().optional(),
  edits: z.array(AgentSchematicEditSchema).min(1).max(256).optional(),
  wireIntent: AgentWireIntentSchema.optional(),
}).superRefine((request, context) => {
  if ((request.edits === undefined) === (request.wireIntent === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Provide exactly one of edits or wireIntent",
    });
  }
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

/**
 * Sole request schema published by the hosted Agent session. Legacy v1 and
 * additive v3 remain readable only by explicit compatibility entry points;
 * they are not advertised to newly connected Agents.
 */
const AgentProductionCapabilitiesRequestSchema =
  ProductionRequestBaseSchema.extend({
    operation: z.literal("capabilities"),
  });
const AgentProductionSnapshotRequestSchema = ProductionRequestBaseSchema.extend(
  {
    operation: z.literal("snapshot"),
    documentId: StableIdSchema,
    includeSourceSpans: z.boolean().optional(),
  },
);
const AgentProductionTransactRequestSchema = ProductionRequestBaseSchema.extend(
  {
    operation: z.literal("transact"),
    documentId: StableIdSchema,
    transactionId: StableIdSchema,
    expectedRevision: z.number().int().nonnegative(),
    dryRun: z.boolean().optional(),
    edits: z.array(AgentSchematicEditSchema).min(1).max(256).optional(),
    wireIntent: AgentWireIntentSchema.optional(),
  },
).superRefine((request, context) => {
  if ((request.edits === undefined) === (request.wireIntent === undefined)) {
    context.addIssue({
      code: "custom",
      message: "Provide exactly one of edits or wireIntent",
    });
  }
});
const AgentProductionRenderRequestSchema = ProductionRequestBaseSchema.extend({
  operation: z.literal("render"),
  documentId: StableIdSchema,
  mode: z.enum(["formal", "diagnostics"]),
  bounds: RectSchema.optional(),
});
export const AgentProductionCircuitRequestSchema = z.discriminatedUnion(
  "operation",
  [
    AgentProductionCapabilitiesRequestSchema,
    AgentProductionSnapshotRequestSchema,
    AgentProductionTransactRequestSchema,
    AgentProductionRenderRequestSchema,
  ],
);

// Visual diagnostics are derived from rendered geometry. Text measurement and
// rotated drafting AABBs legitimately produce fractional coordinates even
// though persisted schematic coordinates remain integer-grid values.
const AgentDiagnosticBoundsSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export const AgentDiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  domain: z.enum(["schema", "spice", "erc", "routing", "visual"]).optional(),
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["structural", "observation"]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  gateEligible: z.boolean().optional(),
  message: z.string(),
  objectIds: z.array(StableIdSchema).optional(),
  path: z.array(z.union([z.string(), z.number().int()])).optional(),
  revision: z.number().int().nonnegative().optional(),
  bounds: AgentDiagnosticBoundsSchema.optional(),
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
  presentation: z.enum(["hollow", "filled", "supply"]),
  position: PointSchema.nullable(),
  netId: StableIdSchema.nullable(),
});

const AgentNetlistFactsSchema = z.strictObject({
  reference: z.string().min(1),
  binding: z
    .discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("primitive"),
        deviceClass: z.string().min(1),
      }),
      z.strictObject({
        kind: z.literal("model"),
        deviceClass: z.string().min(1),
        name: z.string().min(1),
      }),
      z.strictObject({
        kind: z.literal("subcircuit"),
        childDocumentId: StableIdSchema,
        name: z.string().min(1),
      }),
      z.strictObject({
        kind: z.literal("external-subcircuit"),
        name: z.string().min(1),
      }),
    ])
    .optional(),
  parameters: z.record(z.string(), z.string()),
  terminals: z
    .array(
      z.strictObject({
        sourcePosition: z.number().int().nonnegative(),
        pinName: z.string().min(1),
      }),
    )
    .optional(),
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
  mosBulk: z
    .strictObject({
      status: z.enum([
        "explicit",
        "cell-default",
        "product-fallback",
        "no-connect",
        "unresolved",
      ]),
      netId: StableIdSchema.nullable(),
    })
    .optional(),
  sourceRef: SourceSpanSchema.optional(),
  netlist: AgentNetlistFactsSchema.optional(),
});

export const AgentSnapshotNetSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1).nullable(),
  scope: z.enum(["local", "global"]),
  powerDomain: NetPowerDomainSchema,
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
  presentation: RoutePresentationSchema.optional(),
  polyline: z.array(PointSchema).min(2).nullable(),
});

export const AgentSnapshotJunctionSchema = z.strictObject({
  id: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
  role: JunctionRoleSchema.optional(),
});

export const AgentSnapshotNoConnectSchema = NoConnectSchema;

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
  noConnects: z.array(AgentSnapshotNoConnectSchema),
  annotations: z.array(AnnotationSchema),
  // ADR 0010 WP-R4: each drafting object carries its canonical shape plus the
  // derived resolved geometry (position(s)/bounds/diagnostics) computed from
  // the single resolveDraftingObjectGeometry entry.
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

// Compatibility-only v3 Snapshot types remain available to frozen local
// fixtures. Production v2 exposes the same typed netlist facts directly.

export const AgentInstanceNetlistFactsSchema = AgentNetlistFactsSchema;

export const AgentCellInterfaceSchema = z.strictObject({
  name: z.string().min(1),
  portOrder: z.array(StableIdSchema),
});

// A v3 document snapshot is the v2 document snapshot plus the exact cell
// interface; each instance additionally carries its exact typed netlist facts
// when the persisted model record is present.
export const AgentSnapshotInstanceV3Schema = AgentSnapshotInstanceSchema.extend(
  {
    netlist: AgentInstanceNetlistFactsSchema.optional(),
  },
);
export const AgentSnapshotDocumentV3Schema = AgentSnapshotDocumentSchema.extend(
  {
    cellInterface: AgentCellInterfaceSchema.nullable(),
    instances: z.array(AgentSnapshotInstanceV3Schema),
  },
);

export const AgentProjectSnapshotDocumentSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  isTop: z.boolean(),
  revision: z.number().int().nonnegative(),
  cellInterface: AgentCellInterfaceSchema.nullable(),
  portCount: z.number().int().nonnegative(),
  instanceCount: z.number().int().nonnegative(),
  references: z.array(
    z.strictObject({
      instanceId: StableIdSchema,
      targetName: z.string().min(1),
      targetDocumentId: StableIdSchema.nullable(),
    }),
  ),
});

export const AgentProjectSourceSummarySchema = z.strictObject({
  entry: z.string().min(1).nullable(),
  dialect: z.string().min(1),
  sourcePolicy: z.enum(["copy", "reference"]),
  fileCount: z.number().int().nonnegative(),
});

export const AgentProjectSnapshotSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  topDocumentId: StableIdSchema,
  documents: z.array(AgentProjectSnapshotDocumentSchema).min(1),
  sourceSummary: AgentProjectSourceSummarySchema,
});

export const AgentCatalogPinSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string().min(1),
  direction: z.enum(["north", "east", "south", "west"]),
  visibility: z.enum(["visible", "implicit", "conditional"]),
});
export const AgentCatalogVariantSchema = z.strictObject({
  id: StableIdSchema,
  hiddenPinNames: z.array(z.string().min(1)),
});
export const AgentCatalogNetlistSchema = z.strictObject({
  deviceClass: z.string().min(1),
  referencePrefix: z.string().min(1).nullable(),
  pinOrder: z.array(z.string().min(1)),
  targetPolicy: z.enum(["builtin", "required-model", "child-cell", "none"]),
  requiredParameters: z.array(z.string().min(1)),
});
export const AgentCatalogSymbolSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  aliases: z.array(StableIdSchema),
  pins: z.array(AgentCatalogPinSchema),
  variants: z.array(AgentCatalogVariantSchema),
  decorative: z.boolean(),
  netlist: AgentCatalogNetlistSchema.optional(),
});
export const AgentCatalogSnapshotSchema = z.strictObject({
  symbolLibrary: z.strictObject({
    id: StableIdSchema,
    version: StableIdSchema,
  }),
  symbols: z.array(AgentCatalogSymbolSchema),
});

const ResponseBaseSchema = z.strictObject({
  apiVersion: AgentApiVersionSchema,
  requestId: StableIdSchema,
});
export const AgentCapabilitiesResponseSchema = ResponseBaseSchema.extend({
  operation: z.literal("capabilities"),
  ok: z.literal(true),
  capabilities: z.strictObject({
    apiVersions: z.union([
      z.tuple([z.literal(AGENT_API_VERSION)]),
      z.tuple([
        z.literal(AGENT_API_V1_VERSION),
        z.literal(AGENT_API_VERSION),
        z.literal(AGENT_API_V3_VERSION),
      ]),
    ]),
    snapshotVersions: z.union([
      z.tuple([z.literal(AGENT_SNAPSHOT_VERSION)]),
      z.tuple([
        z.literal(AGENT_SNAPSHOT_VERSION),
        z.literal(AGENT_SNAPSHOT_V3_VERSION),
      ]),
    ]),
    operations: z.array(
      z.enum(["capabilities", "query", "snapshot", "transact", "render"]),
    ),
    queryScopes: z.array(QueryScopeKindSchema).optional(),
    editKinds: z.array(z.string().min(1)),
    permissions: z.union([
      AgentPermissionsSchema,
      AgentProductionPermissionsSchema,
    ]),
    limits: z.union([AgentLimitsSchema, AgentProductionLimitsSchema]),
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

// v3 snapshot responses are discriminated by `target` (ADR 0018). Each carries
// apiVersion "3.0"; the `document` target mirrors the v2 envelope (hash,
// byteLength, project index) and adds exact facts + an optional host-supplied
// projectRevision.
const AgentSnapshotProjectIndexSchema =
  AgentSessionSnapshotSchema.shape.project;

export const AgentSnapshotV3DocumentResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_V3_VERSION),
  operation: z.literal("snapshot"),
  ok: z.literal(true),
  target: z.literal("document"),
  revision: z.number().int().nonnegative(),
  electricalTopologyHash: z.string().regex(/^[a-f0-9]{64}$/u),
  byteLength: z.number().int().nonnegative(),
  project: AgentSnapshotProjectIndexSchema,
  document: AgentSnapshotDocumentV3Schema,
  projectRevision: z.number().int().nonnegative().optional(),
  diagnostics: z.array(AgentDiagnosticSchema),
});
export const AgentSnapshotV3ProjectResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_V3_VERSION),
  operation: z.literal("snapshot"),
  ok: z.literal(true),
  target: z.literal("project"),
  project: AgentProjectSnapshotSchema,
  projectRevision: z.number().int().nonnegative().optional(),
  diagnostics: z.array(AgentDiagnosticSchema),
});
export const AgentSnapshotV3CatalogResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_V3_VERSION),
  operation: z.literal("snapshot"),
  ok: z.literal(true),
  target: z.literal("catalog"),
  catalog: AgentCatalogSnapshotSchema,
  diagnostics: z.array(AgentDiagnosticSchema),
});
export const AgentSnapshotV3ResponseSchema = z.discriminatedUnion("target", [
  AgentSnapshotV3DocumentResponseSchema,
  AgentSnapshotV3ProjectResponseSchema,
  AgentSnapshotV3CatalogResponseSchema,
]);
export const AgentTransactSuccessResponseSchema = ResponseBaseSchema.extend({
  operation: z.literal("transact"),
  ok: z.literal(true),
  applied: z.boolean(),
  revision: z.number().int().nonnegative(),
  proposedRevision: z.number().int().nonnegative(),
  diff: AgentDiffSchema,
  diagnostics: z.array(AgentDiagnosticSchema),
  diagnosticDelta: z
    .strictObject({
      added: z.array(AgentDiagnosticSchema),
      removed: z.array(AgentDiagnosticSchema),
    })
    .optional(),
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
  AgentSnapshotV3ResponseSchema,
  AgentTransactSuccessResponseSchema,
  AgentRenderResponseSchema,
  AgentErrorResponseSchema,
]);

const AgentProductionCapabilitiesResponseSchema = ResponseBaseSchema.extend({
  apiVersion: z.literal(AGENT_API_VERSION),
  operation: z.literal("capabilities"),
  ok: z.literal(true),
  capabilities: z.strictObject({
    apiVersions: z.tuple([z.literal(AGENT_API_VERSION)]),
    snapshotVersions: z.tuple([z.literal(AGENT_SNAPSHOT_VERSION)]),
    operations: z.tuple([
      z.literal("capabilities"),
      z.literal("snapshot"),
      z.literal("transact"),
      z.literal("render"),
    ]),
    editKinds: z.array(z.string().min(1)),
    permissions: AgentProductionPermissionsSchema,
    limits: AgentProductionLimitsSchema,
  }),
});
const AgentProductionTransactSuccessResponseSchema =
  AgentTransactSuccessResponseSchema.extend({
    apiVersion: z.literal(AGENT_API_VERSION),
  });
const AgentProductionRenderResponseSchema = AgentRenderResponseSchema.extend({
  apiVersion: z.literal(AGENT_API_VERSION),
});
const AgentProductionErrorResponseSchema = AgentErrorResponseSchema.extend({
  apiVersion: z.literal(AGENT_API_VERSION),
  operation: z.enum(["error", "snapshot", "transact", "render"]),
});
export const AgentProductionCircuitResponseSchema = z.union([
  AgentProductionCapabilitiesResponseSchema,
  AgentSnapshotResponseSchema,
  AgentProductionTransactSuccessResponseSchema,
  AgentProductionRenderResponseSchema,
  AgentProductionErrorResponseSchema,
]);

export const AgentCircuitRequestJsonSchema = z.toJSONSchema(
  AgentProductionCircuitRequestSchema,
  { target: "draft-2020-12", reused: "ref" },
);
export const AgentCircuitResponseJsonSchema = z.toJSONSchema(
  AgentProductionCircuitResponseSchema,
  { target: "draft-2020-12", reused: "ref" },
);

export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
export type AgentLimits = z.infer<typeof AgentLimitsSchema>;
export type AgentCircuitRequest = z.infer<typeof AgentCircuitRequestSchema>;
export type AgentProductionCircuitRequest = z.infer<
  typeof AgentProductionCircuitRequestSchema
>;
export type AgentCapabilitiesRequest = z.infer<
  typeof AgentCapabilitiesRequestSchema
>;
export type AgentQueryRequest = z.infer<typeof AgentQueryRequestSchema>;
export type AgentSnapshotRequest = z.infer<typeof AgentSnapshotRequestSchema>;
export type AgentTransactRequest = z.infer<typeof AgentTransactRequestSchema>;
export type AgentRenderRequest = z.infer<typeof AgentRenderRequestSchema>;
export type AgentCircuitResponse = z.infer<typeof AgentCircuitResponseSchema>;
export type AgentProductionCircuitResponse = z.infer<
  typeof AgentProductionCircuitResponseSchema
>;
export type AgentObjectDescriptor = z.infer<typeof AgentObjectDescriptorSchema>;
export type AgentDiagnostic = z.infer<typeof AgentDiagnosticSchema>;
export type AgentDiff = z.infer<typeof AgentDiffSchema>;
export type AgentSessionSnapshot = z.infer<typeof AgentSessionSnapshotSchema>;
export type AgentSnapshotDocument = z.infer<typeof AgentSnapshotDocumentSchema>;
export type AgentSnapshotDocumentV3 = z.infer<
  typeof AgentSnapshotDocumentV3Schema
>;
export type AgentInstanceNetlistFacts = z.infer<
  typeof AgentInstanceNetlistFactsSchema
>;
export type AgentProjectSnapshot = z.infer<typeof AgentProjectSnapshotSchema>;
export type AgentCatalogSnapshot = z.infer<typeof AgentCatalogSnapshotSchema>;
export type AgentSnapshotV3Response = z.infer<
  typeof AgentSnapshotV3ResponseSchema
>;
