import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 9;

export const StableIdSchema = z.string().min(1).max(256);
/** A persisted Document page point before its Document-grid relation is known. */
export const GridPointSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
});
/** A grid-domain rectangle. Alignment is validated with a Document grid. */
export const GridRectSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
/** Read-only renderer/diagnostic geometry. It may be fractional. */
export const DerivedPointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
/** Read-only renderer/diagnostic bounds. Empty geometry may have zero extent. */
export const DerivedRectSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});
/** Symbol-library artwork coordinates, unrelated to a Document page grid. */
export const SymbolLocalPointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
export const SymbolLocalRectSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});
// Compatibility aliases remain internal migration aids. New code must name
// Grid* or Derived* explicitly at package boundaries.
export const PointSchema = GridPointSchema;
export const RectSchema = GridRectSchema;
export const RotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export const MirrorSchema = z.enum(["none", "x"]);
export const OrientationSchema = z.strictObject({
  rotation: RotationSchema,
  mirror: MirrorSchema,
});

export const SourcePositionSchema = z.strictObject({
  offset: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});
export const SourceSpanSchema = z
  .strictObject({
    fileId: StableIdSchema,
    start: SourcePositionSchema,
    end: SourcePositionSchema,
  })
  .superRefine((span, context) => {
    if (span.end.offset < span.start.offset) {
      context.addIssue({
        code: "custom",
        message: "Source span end must not precede its start",
        path: ["end", "offset"],
      });
    }
  });

export const SourceFileRecordSchema = z.strictObject({
  id: StableIdSchema,
  path: z.string().min(1),
  hash: z.string().min(1),
});
export const SourceManifestSchema = z
  .strictObject({
    entry: z.string().min(1).nullable(),
    dialect: z.string().min(1),
    sourcePolicy: z.enum(["copy", "reference"]),
    files: z.array(SourceFileRecordSchema),
  })
  .superRefine((manifest, context) => {
    reportDuplicateIds(manifest.files, "files", context);
  });
export const SymbolLibraryLockSchema = z.strictObject({
  id: StableIdSchema,
  version: z.string().min(1),
  hash: z.string().min(1),
});

export const TerminalRefSchema = z.strictObject({
  instanceId: StableIdSchema,
  pinName: z.string().min(1),
});
export const PlacementSchema = z.strictObject({
  position: PointSchema,
  rotation: RotationSchema,
  mirror: MirrorSchema,
});
export const InstancePropertyValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);
export const NetlistIdentifierSchema = z.string().min(1).max(128);
export const NetlistParameterNameSchema = NetlistIdentifierSchema;
export const NetlistParameterValueSchema = z.string().min(1).max(1024);
export const NetlistDeviceClassSchema = z.enum([
  "resistor",
  "capacitor",
  "inductor",
  "mos",
  "diode",
  "bjt",
  "voltage-source",
  "current-source",
  "net-marker",
]);
export const InstanceNetlistBindingSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("primitive"),
    deviceClass: NetlistDeviceClassSchema,
  }),
  z.strictObject({
    kind: z.literal("model"),
    deviceClass: NetlistDeviceClassSchema,
    name: NetlistIdentifierSchema,
  }),
  z.strictObject({
    kind: z.literal("subcircuit"),
    childDocumentId: StableIdSchema,
    name: NetlistIdentifierSchema,
  }),
  z.strictObject({
    kind: z.literal("external-subcircuit"),
    name: NetlistIdentifierSchema,
  }),
]);
/**
 * A source-order to Symbol-pin mapping. Electrical Net membership still owns
 * connectivity; this preserves the order an imported structural source used
 * without smuggling it through editable `properties` keys.
 */
export const InstanceNetlistTerminalSchema = z.strictObject({
  sourcePosition: z.number().int().nonnegative(),
  pinName: z.string().min(1).max(128),
});
export const InstanceNetlistDataSchema = z.strictObject({
  reference: NetlistIdentifierSchema,
  binding: InstanceNetlistBindingSchema.optional(),
  parameters: z
    .record(NetlistParameterNameSchema, NetlistParameterValueSchema)
    .refine((parameters) => Object.keys(parameters).length <= 128, {
      message: "An instance may contain at most 128 netlist parameters",
    }),
  // Manual instances need not claim a source ordering. Import and any author
  // that does claim one must provide an unambiguous, typed mapping.
  terminals: z.array(InstanceNetlistTerminalSchema).max(128).optional(),
});
/**
 * Bounded source evidence that explains imported facts but cannot become a
 * second electrical/netlist authority. It is not part of normal editable
 * properties and no runtime consumer may derive connectivity or hierarchy from
 * `sourceTarget` or `attributes`.
 */
export const InstanceImportProvenanceSchema = z.strictObject({
  kind: z.enum(["primitive", "model", "subcircuit", "opaque"]),
  name: z.string().min(1),
  sourceTarget: z.string().min(1).max(1024),
  // External source evidence can preserve a target spelling whose resolution
  // status is unavailable; current importers write status when it is known.
  status: z.enum(["resolved", "missing", "unsupported"]).optional(),
  modelType: z.string().min(1).optional(),
  attributes: z
    .record(z.string().min(1).max(128), InstancePropertyValueSchema)
    .refine((attributes) => Object.keys(attributes).length <= 128, {
      message: "An import provenance record may contain at most 128 attributes",
    })
    .optional(),
});
export const MosBulkBindingSchema = z.strictObject({
  origin: z.enum(["cell-default", "supply-default"]),
  netId: StableIdSchema,
});
export const InstanceSchema = z
  .strictObject({
    id: StableIdSchema,
    symbolId: StableIdSchema,
    symbolVariantId: StableIdSchema.optional(),
    sourceRef: SourceSpanSchema.optional(),
    importProvenance: InstanceImportProvenanceSchema.optional(),
    // Present only for an editor-materialized implicit body connection.
    // Explicit SPICE/user B connections need no parallel metadata.
    mosBulkBinding: MosBulkBindingSchema.optional(),
    placement: PlacementSchema.nullable(),
    properties: z.record(z.string(), InstancePropertyValueSchema),
    netlist: InstanceNetlistDataSchema.optional(),
  })
  .superRefine((instance, context) => {
    for (const key of Object.keys(instance.properties)) {
      if (!key.startsWith("spice.")) continue;
      context.addIssue({
        code: "custom",
        path: ["properties", key],
        message:
          "spice.* properties are invalid; use typed netlist facts or import provenance",
      });
    }
    const terminals = instance.netlist?.terminals;
    if (!terminals) return;
    const positions = new Set<number>();
    const pinNames = new Set<string>();
    for (const [index, terminal] of terminals.entries()) {
      if (positions.has(terminal.sourcePosition)) {
        context.addIssue({
          code: "custom",
          path: ["netlist", "terminals", index, "sourcePosition"],
          message: "Netlist terminal source positions must be unique",
        });
      }
      positions.add(terminal.sourcePosition);
      if (pinNames.has(terminal.pinName)) {
        context.addIssue({
          code: "custom",
          path: ["netlist", "terminals", index, "pinName"],
          message: "Netlist terminal pin names must be unique",
        });
      }
      pinNames.add(terminal.pinName);
    }
  });
/**
 * Persisted electrical supply identity. `conflict` is diagnostic state only;
 * new authoring may choose vdd, ground, or none but never create a
 * short intentionally.
 */
export const NetPowerDomainSchema = z.enum([
  "none",
  "vdd",
  "ground",
  "conflict",
]);
export const NetSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1).optional(),
  scope: z.enum(["local", "global"]),
  // Runtime treats absence as `none` for in-memory construction and never
  // infers power identity from a symbol, name, or fixed Net ID.
  powerDomain: NetPowerDomainSchema.optional(),
  terminals: z.array(TerminalRefSchema),
});

export const RouteEndpointSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("terminal"),
    instanceId: StableIdSchema,
    pinName: z.string().min(1),
  }),
  z.strictObject({ kind: z.literal("junction"), junctionId: StableIdSchema }),
]);
export const SegmentModeSchema = z.enum([
  "auto",
  "escape",
  "manual",
  "locked",
  "trunk",
]);
export const RoutePresentationSchema = z.enum([
  "wire",
  "bulk-dashed",
  "power-rail",
]);
export const RouteBranchSchema = z
  .strictObject({
    id: StableIdSchema,
    netId: StableIdSchema,
    from: RouteEndpointSchema,
    to: RouteEndpointSchema,
    waypoints: z.array(PointSchema),
    segmentModes: z.array(SegmentModeSchema),
    // Electrical connectivity is always owned by `netId` and the endpoints.
    // This field changes only how the same editable Route is presented.
    presentation: RoutePresentationSchema.optional(),
  })
  .superRefine((route, context) => {
    if (route.segmentModes.length !== route.waypoints.length + 1) {
      context.addIssue({
        code: "custom",
        message: "A route requires one segment mode per geometric segment",
        path: ["segmentModes"],
      });
    }
  });
export const JunctionRoleSchema = z.enum([
  "branch",
  "label-anchor",
  "route-anchor",
]);
export const JunctionSchema = z.strictObject({
  id: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
  // Older Projects predate explicit Junction roles. Consumers must preserve
  // their behavior by treating an omitted role as an intentional branch dot.
  role: JunctionRoleSchema.optional(),
});
// ADR 0013 / WP-R7 NoConnect: an explicit electrical declaration that a Pin or
// Port is intentionally left open. It is a first-class electrical record (typed
// edits, undo/redo, clipboard, export), not an annotation. A NoConnect endpoint
// must not also belong to a Net, Route, or another NoConnect (enforced in the
// document superRefine).
export const NoConnectEndpointSchema = z.strictObject({
  kind: z.literal("terminal"),
  instanceId: StableIdSchema,
  pinName: z.string().min(1),
});
export const NoConnectSchema = z.strictObject({
  id: StableIdSchema,
  endpoint: NoConnectEndpointSchema,
  reason: z.string().optional(),
});

export const AnnotationKindSchema = z.enum([
  "instance-label",
  "net-label",
  "power-label",
  "route-marker",
]);
// ADR 0010 SchematicAnnotation marker kinds.
export const RouteMarkerKindSchema = z.enum(["current", "voltage"]);
export const RouteAnnotationAttachmentSchema = z.strictObject({
  routeId: StableIdSchema,
  segmentIndex: z.number().int().nonnegative(),
  t: z.number().min(0).max(1),
  direction: z.enum(["forward", "reverse"]),
  // Signed distance along the route's geometric normal. Negative puts the
  // default Razavi current label above a left-to-right wire.
  normalOffset: z.number().finite(),
});
export const AnnotationSchema = z
  .strictObject({
    id: StableIdSchema,
    kind: AnnotationKindSchema,
    // Schema-v7 gives every editable annotation one presentation authority.
    // `content` is the visual/semantic text source and `anchor` is the only
    // visual attachment. A Net relation is deliberately separate from anchor:
    // it expresses electrical meaning, never a placement shortcut.
    content: z.lazy(() => RichTextDocumentSchema),
    anchor: z.lazy(() => VisualAnchorSchema),
    netId: StableIdSchema.optional(),
    alignment: z.enum(["start", "middle", "end"]),
    rotation: RotationSchema,
    locked: z.boolean(),
    sizeScale: z.number().finite().positive().optional(),
    // SchematicAnnotation route-marker discriminator (ADR 0010).
    markerKind: RouteMarkerKindSchema.optional(),
  })
  .superRefine((annotation, context) => {
    if (annotation.markerKind && annotation.kind !== "route-marker") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["markerKind"],
        message: "markerKind is only valid on a route-marker annotation",
      });
    }
    if (
      (annotation.kind === "net-label" || annotation.kind === "power-label") &&
      !annotation.netId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["netId"],
        message: "Net and power labels require a Net identity",
      });
    }
    if (
      annotation.kind !== "net-label" &&
      annotation.kind !== "power-label" &&
      annotation.netId !== undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["netId"],
        message: "netId is only valid on net and power labels",
      });
    }
  });

// --- Text & Peripheral Editing System (ADR 0010) --------------------------
// Resource bounds are part of the current contract:
// nesting depth <= 4, <= 64 runs per document, and <= 256 chars per text run.

export type RichTextStyle = "italic" | "bold" | "subscript" | "superscript";

export type RichTextRun =
  | { kind: "text"; value: string }
  | { kind: "line-break" }
  | { kind: "span"; style: RichTextStyle; children: RichTextRun[] };

export interface RichTextDocument {
  runs: RichTextRun[];
}

const RICH_TEXT_MAX_DEPTH = 4;
const RICH_TEXT_MAX_RUNS = 64;
const RICH_TEXT_MAX_TEXT_LENGTH = 256;

function richTextRunSchema(depth: number): z.ZodTypeAny {
  const text = z.strictObject({
    kind: z.literal("text"),
    value: z.string().min(1).max(RICH_TEXT_MAX_TEXT_LENGTH),
  });
  const lineBreak = z.strictObject({ kind: z.literal("line-break") });
  if (depth >= RICH_TEXT_MAX_DEPTH) {
    // Leaf-only: deeper nesting is rejected by the bound, not by omitting the
    // fields, so the deepest level may still carry text and line-break runs.
    return z.union([text, lineBreak]);
  }
  const span = z.strictObject({
    kind: z.literal("span"),
    style: z.enum(["italic", "bold", "subscript", "superscript"]),
    children: z
      .array(richTextRunSchema(depth + 1))
      .min(1)
      .max(RICH_TEXT_MAX_RUNS),
  });
  return z.union([text, lineBreak, span]);
}

function richTextDocumentSchema(depth: number): z.ZodTypeAny {
  return z.strictObject({
    runs: z.array(richTextRunSchema(depth)).min(1).max(RICH_TEXT_MAX_RUNS),
  });
}

export const RichTextDocumentSchema = richTextDocumentSchema(
  0,
) as z.ZodType<RichTextDocument>;
export const RichTextRunSchema = richTextRunSchema(0) as z.ZodType<RichTextRun>;

export const VisualAnchorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("free"),
    position: PointSchema,
  }),
  z.strictObject({
    kind: z.literal("object"),
    objectId: StableIdSchema,
    localOffset: PointSchema,
    fallbackPosition: PointSchema,
  }),
  z.strictObject({
    kind: z.literal("route"),
    routeId: StableIdSchema,
    segmentIndex: z.number().int().nonnegative(),
    t: z.number().min(0).max(1),
    normalOffset: z.number().finite(),
    direction: z.enum(["forward", "reverse"]),
    orientation: z.enum(["follow", "horizontal"]),
    fallbackPosition: PointSchema,
  }),
]);

// DraftingObject union (ADR 0010). Each member shares id/locked/zIndex, an
// optional styleOverride, and a VisualAnchor. A1a ships the minimal set with
// text fully populated; arrow/leader/callout/construction-line/rectangle/
// floating-symbol carry their discriminator and anchor so the Edit Engine can
// route them, with kind-specific fields added as their tooling lands (WP-A2/A4).
const DraftingObjectBaseSchema = z.strictObject({
  id: StableIdSchema,
  locked: z.boolean(),
  zIndex: z.number().int().nonnegative(),
  anchor: VisualAnchorSchema,
  styleOverride: z
    .strictObject({
      sizeScale: z.number().finite().positive().optional(),
      weight: z.enum(["normal", "bold"]).optional(),
      italic: z.boolean().optional(),
      lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
      arrowHead: z.enum(["none", "filled", "open"]).optional(),
      // Bounded ratios against the Razavi profile baseline — never raw px. The
      // renderer multiplies profile.strokes.annotation / arrow head geometry so
      // formal SVG/PNG/PDF and the editor canvas share one visual parameter.
      strokeScale: z
        .union([z.literal(0.75), z.literal(1), z.literal(1.5), z.literal(2)])
        .optional(),
      arrowHeadScale: z
        .union([z.literal(0.75), z.literal(1), z.literal(1.25), z.literal(1.5)])
        .optional(),
    })
    .optional(),
});

export const DraftTextSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("text"),
  content: RichTextDocumentSchema,
  alignment: z.enum(["start", "middle", "end"]),
  rotation: RotationSchema,
  typographyToken: z.enum(["caption", "body", "label"]).optional(),
});

export const DraftArrowSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("arrow"),
  from: VisualAnchorSchema,
  to: VisualAnchorSchema,
  // Interior free points make a drafting arrow elastically reshapeable without
  // weakening either endpoint's attachment contract. Omitted means a legacy
  // two-point arrow.
  waypoints: z.array(PointSchema).optional(),
  // One optional quadratic Bézier control per visible path segment. A null
  // entry keeps that segment straight, so legacy arrows need no migration.
  curveControls: z.array(PointSchema.nullable()).optional(),
});

export const DraftLeaderSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("leader"),
  target: VisualAnchorSchema,
});

export const DraftCalloutSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("callout"),
  content: RichTextDocumentSchema,
  alignment: z.enum(["start", "middle", "end"]),
  rotation: RotationSchema,
  typographyToken: z.enum(["caption", "body", "label"]).optional(),
  target: VisualAnchorSchema,
});

export const DraftConstructionLineSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("construction-line"),
  points: z.array(PointSchema).min(2),
  curveControls: z.array(PointSchema.nullable()).optional(),
  lineStyle: z.enum(["solid", "dashed", "dotted"]),
});

export const DraftRectangleSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("rectangle"),
  center: PointSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  // Free drafting geometry is allowed to rotate continuously. Persist a
  // normalized bearing rather than restricting the rectangle to symbol-style
  // quarter turns.
  rotation: z.number().finite().min(0).lt(360),
  lineStyle: z.enum(["solid", "dashed", "dotted"]),
});

export const DraftFloatingSymbolSchema = DraftingObjectBaseSchema.extend({
  kind: z.literal("floating-symbol"),
  symbolId: StableIdSchema,
  // Decorative-only: enforced by the Edit Engine via the Symbol Resolver, not
  // by this schema (ADR 0010).
  transform: OrientationSchema,
});

export const DraftingObjectSchema = z.discriminatedUnion("kind", [
  DraftTextSchema,
  DraftArrowSchema,
  DraftLeaderSchema,
  DraftCalloutSchema,
  DraftConstructionLineSchema,
  DraftRectangleSchema,
  DraftFloatingSymbolSchema,
]);

export const DraftingLayerSchema = z.strictObject({
  objects: z.array(DraftingObjectSchema),
});
export const PresentationIntentSchema = z.strictObject({
  styleProfileId: StableIdSchema,
  grid: z.number().int().positive(),
  compactness: z.enum(["loose", "normal", "compact"]),
  flow: z
    .strictObject({
      power: z.literal("top").optional(),
      ground: z.literal("bottom").optional(),
      input: z.literal("left").optional(),
      output: z.literal("right").optional(),
    })
    .optional(),
});
export const MosBulkDefaultsSchema = z.strictObject({
  nmosNetId: StableIdSchema.optional(),
  pmosNetId: StableIdSchema.optional(),
});
export const LayoutGroupSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "differential-pair",
    "current-mirror",
    "matched-pair",
    "custom",
  ]),
  objectIds: z.array(StableIdSchema).min(1),
  locked: z.boolean(),
});
export const LayoutConstraintSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "align-x",
    "align-y",
    "symmetric",
    "equal-spacing",
    "keep-clear",
  ]),
  objectIds: z.array(StableIdSchema).min(2),
  locked: z.boolean(),
});
export const SourceBindingSchema = z.strictObject({
  cellName: z.string().min(1),
  sourceRef: SourceSpanSchema,
});
/**
 * Imported SPICE topology can remain electrically authoritative after manual
 * placement and partial routing. This state owns only the optional dashed
 * routing guidance; it must not be inferred from source synchronization.
 */
export const FlightlineGuidanceSchema = z.enum(["active", "dismissed"]);
export const CellNetlistTerminalSchema = z.strictObject({
  name: NetlistIdentifierSchema,
  netId: StableIdSchema,
});
export const CellNetlistInterfaceSchema = z.strictObject({
  name: NetlistIdentifierSchema,
  terminals: z.array(CellNetlistTerminalSchema),
});

const SchematicDocumentBaseSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  revision: z.number().int().nonnegative(),
  sourceBinding: SourceBindingSchema.optional(),
  sourceStatus: z.enum([
    "in-sync",
    "geometry-only-changed",
    "connectivity-modified",
  ]),
  flightlineGuidance: FlightlineGuidanceSchema.optional(),
  netlist: CellNetlistInterfaceSchema.optional(),
  instances: z.array(InstanceSchema),
  nets: z.array(NetSchema),
  routes: z.array(RouteBranchSchema),
  junctions: z.array(JunctionSchema),
  annotations: z.array(AnnotationSchema),
  presentation: PresentationIntentSchema,
  // Stable Net references for explicit cell-level well/substrate intent.
  mosBulkDefaults: MosBulkDefaultsSchema.optional(),
  layoutGroups: z.array(LayoutGroupSchema),
  constraints: z.array(LayoutConstraintSchema),
  noConnects: z.array(NoConnectSchema).default([]),
  // Drafting remains optional for programmatic in-memory Documents; canonical
  // factories and persisted fixtures write an explicit empty layer.
  drafting: DraftingLayerSchema.optional(),
});

function reportDuplicateIds(
  entries: ReadonlyArray<{ id: string }>,
  path: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ID: ${entry.id}`,
        path: [path, index, "id"],
      });
    }
    seen.add(entry.id);
  }
}

function reportGridPoint(
  point: GridPoint,
  grid: number,
  path: ReadonlyArray<string | number>,
  context: z.RefinementCtx,
): void {
  for (const axis of ["x", "y"] as const) {
    if (point[axis] % grid === 0) continue;
    context.addIssue({
      code: "custom",
      message: `Document page coordinates must align to grid ${grid}`,
      path: [...path, axis],
    });
  }
}

function reportVisualAnchorGridAlignment(
  anchor: VisualAnchor,
  grid: number,
  path: ReadonlyArray<string | number>,
  context: z.RefinementCtx,
): void {
  switch (anchor.kind) {
    case "free":
      reportGridPoint(anchor.position, grid, [...path, "position"], context);
      return;
    case "object":
      reportGridPoint(
        anchor.localOffset,
        grid,
        [...path, "localOffset"],
        context,
      );
      reportGridPoint(
        anchor.fallbackPosition,
        grid,
        [...path, "fallbackPosition"],
        context,
      );
      return;
    case "route":
      // `t` and normalOffset are parametric scalars, not page coordinates.
      reportGridPoint(
        anchor.fallbackPosition,
        grid,
        [...path, "fallbackPosition"],
        context,
      );
  }
}

function reportDraftingObjectGridAlignment(
  object: DraftingObject,
  grid: number,
  path: ReadonlyArray<string | number>,
  context: z.RefinementCtx,
): void {
  reportVisualAnchorGridAlignment(
    object.anchor,
    grid,
    [...path, "anchor"],
    context,
  );
  switch (object.kind) {
    case "text":
    case "floating-symbol":
      return;
    case "arrow":
      reportVisualAnchorGridAlignment(
        object.from,
        grid,
        [...path, "from"],
        context,
      );
      reportVisualAnchorGridAlignment(
        object.to,
        grid,
        [...path, "to"],
        context,
      );
      object.waypoints?.forEach((point, index) =>
        reportGridPoint(point, grid, [...path, "waypoints", index], context),
      );
      object.curveControls?.forEach((point, index) => {
        if (point) {
          reportGridPoint(
            point,
            grid,
            [...path, "curveControls", index],
            context,
          );
        }
      });
      return;
    case "leader":
      reportVisualAnchorGridAlignment(
        object.target,
        grid,
        [...path, "target"],
        context,
      );
      return;
    case "callout":
      reportVisualAnchorGridAlignment(
        object.target,
        grid,
        [...path, "target"],
        context,
      );
      return;
    case "construction-line":
      object.points.forEach((point, index) =>
        reportGridPoint(point, grid, [...path, "points", index], context),
      );
      object.curveControls?.forEach((point, index) => {
        if (point) {
          reportGridPoint(
            point,
            grid,
            [...path, "curveControls", index],
            context,
          );
        }
      });
      return;
    case "rectangle":
      reportGridPoint(object.center, grid, [...path, "center"], context);
  }
}

export const SchematicDocumentSchema = SchematicDocumentBaseSchema.superRefine(
  (document, context) => {
    const objectCollections = [
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
      ...(document.drafting?.objects ?? []),
    ];
    for (const [key, netId] of Object.entries(document.mosBulkDefaults ?? {})) {
      if (!document.nets.some((net) => net.id === netId)) {
        context.addIssue({
          code: "custom",
          message: `MOS bulk default references an unknown Net: ${netId}`,
          path: ["mosBulkDefaults", key],
        });
      }
    }
    if (document.netlist) {
      const terminalNames = new Set<string>();
      for (const [
        terminalIndex,
        terminal,
      ] of document.netlist.terminals.entries()) {
        const normalizedName = terminal.name.toLowerCase();
        if (terminalNames.has(normalizedName)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate netlist terminal name: ${terminal.name}`,
            path: ["netlist", "terminals", terminalIndex, "name"],
          });
        }
        terminalNames.add(normalizedName);
        if (!document.nets.some((net) => net.id === terminal.netId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown netlist terminal Net: ${terminal.netId}`,
            path: ["netlist", "terminals", terminalIndex, "netId"],
          });
        }
      }
    }
    const netlistReferences = new Set<string>();
    for (const [instanceIndex, instance] of document.instances.entries()) {
      const reference = instance.netlist?.reference.toLowerCase();
      if (!reference) continue;
      if (netlistReferences.has(reference)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate netlist instance reference: ${instance.netlist!.reference}`,
          path: ["instances", instanceIndex, "netlist", "reference"],
        });
      }
      netlistReferences.add(reference);
    }
    for (const [instanceIndex, instance] of document.instances.entries()) {
      const binding = instance.mosBulkBinding;
      if (!binding) continue;
      const net = document.nets.find(
        (candidate) => candidate.id === binding.netId,
      );
      if (
        !net?.terminals.some(
          (terminal) =>
            terminal.instanceId === instance.id && terminal.pinName === "B",
        )
      ) {
        context.addIssue({
          code: "custom",
          message: `MOS bulk binding is not materialized on Net: ${binding.netId}`,
          path: ["instances", instanceIndex, "mosBulkBinding"],
        });
      }
    }
    reportDuplicateIds(objectCollections, "objects", context);
    const grid = document.presentation.grid;
    document.instances.forEach((instance, index) => {
      if (instance.placement) {
        reportGridPoint(
          instance.placement.position,
          grid,
          ["instances", index, "placement", "position"],
          context,
        );
      }
    });
    document.routes.forEach((route, routeIndex) => {
      route.waypoints.forEach((point, pointIndex) =>
        reportGridPoint(
          point,
          grid,
          ["routes", routeIndex, "waypoints", pointIndex],
          context,
        ),
      );
    });
    document.junctions.forEach((junction, index) =>
      reportGridPoint(
        junction.position,
        grid,
        ["junctions", index, "position"],
        context,
      ),
    );
    document.annotations.forEach((annotation, index) =>
      reportVisualAnchorGridAlignment(
        annotation.anchor,
        grid,
        ["annotations", index, "anchor"],
        context,
      ),
    );
    document.drafting?.objects.forEach((object, index) =>
      reportDraftingObjectGridAlignment(
        object,
        grid,
        ["drafting", "objects", index],
        context,
      ),
    );

    const instanceIds = new Set(
      document.instances.map((instance) => instance.id),
    );
    const netIds = new Set(document.nets.map((net) => net.id));
    const netById = new Map(document.nets.map((net) => [net.id, net]));
    const junctionById = new Map(
      document.junctions.map((junction) => [junction.id, junction]),
    );
    const anchorObjectIds = new Set([
      ...document.instances.map((item) => item.id),
      ...document.junctions.map((item) => item.id),
    ]);
    const attachableIds = new Set([
      ...anchorObjectIds,
      ...document.nets.map((item) => item.id),
      ...document.routes.map((item) => item.id),
    ]);
    const layoutObjectIds = new Set([
      ...attachableIds,
      ...document.annotations.map((item) => item.id),
    ]);
    const terminalNetByKey = new Map<string, string>();

    for (const [
      annotationIndex,
      annotation,
    ] of document.annotations.entries()) {
      const anchor = annotation.anchor;
      if (anchor.kind === "object" && !anchorObjectIds.has(anchor.objectId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown annotation anchor target: ${anchor.objectId}`,
          path: ["annotations", annotationIndex, "anchor", "objectId"],
        });
      }
      if (
        anchor.kind === "route" &&
        !document.routes.some((route) => route.id === anchor.routeId)
      ) {
        context.addIssue({
          code: "custom",
          message: `Unknown annotation route anchor: ${anchor.routeId}`,
          path: ["annotations", annotationIndex, "anchor", "routeId"],
        });
      }
      if (annotation.netId !== undefined && !netIds.has(annotation.netId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown annotation Net: ${annotation.netId}`,
          path: ["annotations", annotationIndex, "netId"],
        });
      }
    }
    for (const [collectionName, collection] of [
      ["layoutGroups", document.layoutGroups],
      ["constraints", document.constraints],
    ] as const) {
      for (const [collectionIndex, item] of collection.entries()) {
        const seen = new Set<string>();
        for (const [objectIndex, objectId] of item.objectIds.entries()) {
          if (seen.has(objectId)) {
            context.addIssue({
              code: "custom",
              message: `Duplicate layout object: ${objectId}`,
              path: [collectionName, collectionIndex, "objectIds", objectIndex],
            });
          }
          seen.add(objectId);
          if (!layoutObjectIds.has(objectId)) {
            context.addIssue({
              code: "custom",
              message: `Unknown layout object: ${objectId}`,
              path: [collectionName, collectionIndex, "objectIds", objectIndex],
            });
          }
        }
      }
    }

    for (const [netIndex, net] of document.nets.entries()) {
      const terminalKeys = new Set<string>();
      for (const [terminalIndex, terminal] of net.terminals.entries()) {
        const terminalKey = `${terminal.instanceId}\u0000${terminal.pinName}`;
        if (terminalKeys.has(terminalKey)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate terminal on net: ${terminal.instanceId}.${terminal.pinName}`,
            path: ["nets", netIndex, "terminals", terminalIndex],
          });
        }
        terminalKeys.add(terminalKey);
        const terminalOwner = terminalNetByKey.get(terminalKey);
        if (terminalOwner && terminalOwner !== net.id) {
          context.addIssue({
            code: "custom",
            message: `Terminal belongs to multiple nets: ${terminal.instanceId}.${terminal.pinName}`,
            path: ["nets", netIndex, "terminals", terminalIndex],
          });
        } else {
          terminalNetByKey.set(terminalKey, net.id);
        }
        if (!instanceIds.has(terminal.instanceId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown terminal instance: ${terminal.instanceId}`,
            path: ["nets", netIndex, "terminals", terminalIndex, "instanceId"],
          });
        }
      }
    }

    const noConnectEndpointKeys = new Set<string>();
    for (const [noConnectIndex, noConnect] of document.noConnects.entries()) {
      const endpoint = noConnect.endpoint;
      let key: string;
      let netOwner: string | undefined;
      if (!instanceIds.has(endpoint.instanceId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown NoConnect terminal instance: ${endpoint.instanceId}`,
          path: ["noConnects", noConnectIndex, "endpoint", "instanceId"],
        });
      }
      key = `${endpoint.instanceId}\u0000${endpoint.pinName}`;
      netOwner = terminalNetByKey.get(key);
      if (netOwner) {
        context.addIssue({
          code: "custom",
          message: `NoConnect endpoint is already connected to net: ${netOwner}`,
          path: ["noConnects", noConnectIndex, "endpoint"],
        });
      }
      if (noConnectEndpointKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate NoConnect on the same endpoint",
          path: ["noConnects", noConnectIndex, "endpoint"],
        });
      }
      noConnectEndpointKeys.add(key);
    }

    for (const [junctionIndex, junction] of document.junctions.entries()) {
      if (!netIds.has(junction.netId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown junction net: ${junction.netId}`,
          path: ["junctions", junctionIndex, "netId"],
        });
      }
    }

    for (const [routeIndex, route] of document.routes.entries()) {
      if (!netIds.has(route.netId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown route net: ${route.netId}`,
          path: ["routes", routeIndex, "netId"],
        });
        continue;
      }
      const routeNet = netById.get(route.netId);
      for (const endpointName of ["from", "to"] as const) {
        const endpoint = route[endpointName];
        if (
          endpoint.kind === "terminal" &&
          !instanceIds.has(endpoint.instanceId)
        ) {
          context.addIssue({
            code: "custom",
            message: `Unknown route terminal instance: ${endpoint.instanceId}`,
            path: ["routes", routeIndex, endpointName, "instanceId"],
          });
        } else if (
          endpoint.kind === "terminal" &&
          routeNet &&
          !routeNet.terminals.some(
            (terminal) =>
              terminal.instanceId === endpoint.instanceId &&
              terminal.pinName === endpoint.pinName,
          )
        ) {
          context.addIssue({
            code: "custom",
            message:
              "Route terminal endpoint must be a member of the route net",
            path: ["routes", routeIndex, endpointName],
          });
        }
        if (endpoint.kind === "junction") {
          const junction = junctionById.get(endpoint.junctionId);
          if (!junction) {
            context.addIssue({
              code: "custom",
              message: `Unknown route junction: ${endpoint.junctionId}`,
              path: ["routes", routeIndex, endpointName, "junctionId"],
            });
          } else if (junction.netId !== route.netId) {
            context.addIssue({
              code: "custom",
              message:
                "Route and endpoint junction must belong to the same net",
              path: ["routes", routeIndex, endpointName, "junctionId"],
            });
          }
        }
      }
    }
  },
);

export const CircuitProjectSchema = z
  .strictObject({
    schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
    id: StableIdSchema,
    name: z.string().min(1),
    source: SourceManifestSchema,
    symbolLibrary: SymbolLibraryLockSchema,
    topDocumentId: StableIdSchema,
    documents: z.array(SchematicDocumentSchema).min(1),
  })
  .superRefine((project, context) => {
    const cellNames = new Set<string>();
    for (const [documentIndex, document] of project.documents.entries()) {
      const name = document.netlist?.name.toLowerCase();
      if (!name) continue;
      if (cellNames.has(name)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate netlist Cell name: ${document.netlist!.name}`,
          path: ["documents", documentIndex, "netlist", "name"],
        });
      }
      cellNames.add(name);
    }
    reportDuplicateIds(project.documents, "documents", context);
    if (
      !project.documents.some(
        (document) => document.id === project.topDocumentId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Unknown top document: ${project.topDocumentId}`,
        path: ["topDocumentId"],
      });
    }
  });

export const CircuitProjectJsonSchema = z.toJSONSchema(CircuitProjectSchema, {
  target: "draft-2020-12",
});
export const SchematicDocumentJsonSchema = z.toJSONSchema(
  SchematicDocumentSchema,
  {
    target: "draft-2020-12",
  },
);

export type StableId = z.infer<typeof StableIdSchema>;
export type GridPoint = z.infer<typeof GridPointSchema>;
export type GridRect = z.infer<typeof GridRectSchema>;
export type DerivedPoint = z.infer<typeof DerivedPointSchema>;
export type DerivedRect = z.infer<typeof DerivedRectSchema>;
export type SymbolLocalPoint = z.infer<typeof SymbolLocalPointSchema>;
export type SymbolLocalRect = z.infer<typeof SymbolLocalRectSchema>;
/** @deprecated Name the coordinate domain as GridPoint or DerivedPoint. */
export type Point = GridPoint;
/** @deprecated Name the coordinate domain as GridRect or DerivedRect. */
export type Rect = GridRect;
export type Rotation = z.infer<typeof RotationSchema>;
export type Mirror = z.infer<typeof MirrorSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type SourcePosition = z.infer<typeof SourcePositionSchema>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type SymbolLibraryLock = z.infer<typeof SymbolLibraryLockSchema>;
export type InstanceImportProvenance = z.infer<
  typeof InstanceImportProvenanceSchema
>;
export type NetlistDeviceClass = z.infer<typeof NetlistDeviceClassSchema>;
export type InstanceNetlistBinding = z.infer<
  typeof InstanceNetlistBindingSchema
>;
export type InstanceNetlistData = z.infer<typeof InstanceNetlistDataSchema>;
export type CellNetlistInterface = z.infer<typeof CellNetlistInterfaceSchema>;
export type CellNetlistTerminal = z.infer<typeof CellNetlistTerminalSchema>;
export type MosBulkBinding = z.infer<typeof MosBulkBindingSchema>;
export type TerminalRef = z.infer<typeof TerminalRefSchema>;
export type Instance = z.infer<typeof InstanceSchema>;
export type Net = z.infer<typeof NetSchema>;
export type NetPowerDomain = z.infer<typeof NetPowerDomainSchema>;
export type RouteEndpoint = z.infer<typeof RouteEndpointSchema>;
export type RouteBranch = z.infer<typeof RouteBranchSchema>;
export type RoutePresentation = z.infer<typeof RoutePresentationSchema>;
export type Junction = z.infer<typeof JunctionSchema>;
export type NoConnectEndpoint = z.infer<typeof NoConnectEndpointSchema>;
export type NoConnect = z.infer<typeof NoConnectSchema>;
export type JunctionRole = z.infer<typeof JunctionRoleSchema>;
export type AnnotationKind = z.infer<typeof AnnotationKindSchema>;
export type RouteMarkerKind = z.infer<typeof RouteMarkerKindSchema>;
export type RouteAnnotationAttachment = z.infer<
  typeof RouteAnnotationAttachmentSchema
>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type VisualAnchor = z.infer<typeof VisualAnchorSchema>;
export type DraftText = z.infer<typeof DraftTextSchema>;
export type DraftArrow = z.infer<typeof DraftArrowSchema>;
export type DraftLeader = z.infer<typeof DraftLeaderSchema>;
export type DraftCallout = z.infer<typeof DraftCalloutSchema>;
export type DraftConstructionLine = z.infer<typeof DraftConstructionLineSchema>;
export type DraftRectangle = z.infer<typeof DraftRectangleSchema>;
export type DraftFloatingSymbol = z.infer<typeof DraftFloatingSymbolSchema>;
export type DraftingObject = z.infer<typeof DraftingObjectSchema>;
export type DraftingLayer = z.infer<typeof DraftingLayerSchema>;
export type PresentationIntent = z.infer<typeof PresentationIntentSchema>;
export type LayoutGroup = z.infer<typeof LayoutGroupSchema>;
export type LayoutConstraint = z.infer<typeof LayoutConstraintSchema>;
export type SchematicDocument = z.infer<typeof SchematicDocumentSchema>;
export type CircuitProject = z.infer<typeof CircuitProjectSchema>;
