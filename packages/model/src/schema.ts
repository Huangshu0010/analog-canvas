import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 3;

export const StableIdSchema = z.string().min(1).max(256);
export const PointSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
});
export const RectSchema = z.strictObject({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
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
// Stable import-time evidence for a model/subcircuit binding. It intentionally
// does not replace the lossless `spice.*` compatibility properties; consumers
// such as ERC must use this fact rather than attempt to re-parse those strings.
// Optional presence keeps pre-evidence Project files valid without guessing a
// status during migration.
export const SourceBindingEvidenceSchema = z.strictObject({
  kind: z.enum(["primitive", "model", "subcircuit", "opaque"]),
  name: z.string().min(1),
  status: z.enum(["resolved", "missing", "unsupported"]),
  modelType: z.string().min(1).optional(),
  childDocumentId: StableIdSchema.optional(),
  sourceRef: SourceSpanSchema.optional(),
});
export const InstanceSchema = z.strictObject({
  id: StableIdSchema,
  symbolId: StableIdSchema,
  symbolVariantId: StableIdSchema.optional(),
  sourceRef: SourceSpanSchema.optional(),
  binding: SourceBindingEvidenceSchema.optional(),
  placement: PlacementSchema.nullable(),
  properties: z.record(z.string(), InstancePropertyValueSchema),
});
export const PortSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1),
  direction: z.enum(["input", "output", "bidirectional", "passive"]),
  position: PointSchema.nullable(),
});
export const NetSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1).optional(),
  scope: z.enum(["local", "global"]),
  terminals: z.array(TerminalRefSchema),
  ports: z.array(StableIdSchema),
});

export const RouteEndpointSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("terminal"),
    instanceId: StableIdSchema,
    pinName: z.string().min(1),
  }),
  z.strictObject({ kind: z.literal("port"), portId: StableIdSchema }),
  z.strictObject({ kind: z.literal("junction"), junctionId: StableIdSchema }),
]);
export const SegmentModeSchema = z.enum([
  "auto",
  "escape",
  "manual",
  "locked",
  "trunk",
]);
export const RouteBranchSchema = z
  .strictObject({
    id: StableIdSchema,
    netId: StableIdSchema,
    from: RouteEndpointSchema,
    to: RouteEndpointSchema,
    waypoints: z.array(PointSchema),
    segmentModes: z.array(SegmentModeSchema),
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
export const NoConnectEndpointSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("terminal"),
    instanceId: StableIdSchema,
    pinName: z.string().min(1),
  }),
  z.strictObject({ kind: z.literal("port"), portId: StableIdSchema }),
]);
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
    // Optional explicit RichText presentation saved by the canvas editor.
    // `text` remains the canonical semantic/electrical identity. When this is
    // absent, formal rendering derives standardized appearance from `text`;
    // when present, it preserves the user's explicit formatting.
    content: z.lazy(() => RichTextDocumentSchema).optional(),
    text: z.string(),
    position: PointSchema,
    attachedObjectId: StableIdSchema.optional(),
    routeAttachment: RouteAnnotationAttachmentSchema.optional(),
    offset: PointSchema,
    alignment: z.enum(["start", "middle", "end"]),
    rotation: RotationSchema,
    locked: z.boolean(),
    sizeScale: z.number().finite().positive().optional(),
    // SchematicAnnotation route-marker discriminator (ADR 0010).
    markerKind: RouteMarkerKindSchema.optional(),
    // ADR 0010 VisualAnchor for route-marker annotations. Declared lazily so the
    // schema can reference VisualAnchorSchema, which is defined below.
    anchor: z.lazy(() => VisualAnchorSchema).optional(),
  })
  .superRefine((annotation, context) => {
    if (annotation.markerKind && annotation.kind !== "route-marker") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["markerKind"],
        message: "markerKind is only valid on a route-marker annotation",
      });
    }
  });

// --- Text & Peripheral Editing System (ADR 0010) schema-2 types ----------
//
// A1a accepts these alongside the legacy annotation kinds; the schema-1
// constant is unchanged. Resource bounds are part of the frozen contract:
// nesting depth <= 4, <= 64 runs per document, <= 256 chars per text run,
// and a fraction numerator/denominator must each be non-empty.

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
  const fraction = z.strictObject({
    kind: z.literal("fraction"),
    numerator: richTextDocumentSchema(depth + 1),
    denominator: richTextDocumentSchema(depth + 1),
  });
  return z.union([text, lineBreak, span, fraction]);
}

function richTextDocumentSchema(depth: number): z.ZodTypeAny {
  return z.strictObject({
    runs: z.array(richTextRunSchema(depth)).min(1).max(RICH_TEXT_MAX_RUNS),
  });
}

export const RichTextDocumentSchema = richTextDocumentSchema(0) as z.ZodType<{
  runs: unknown[];
}>;
export const RichTextRunSchema = richTextRunSchema(0);

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

export const GuideSchema = z.strictObject({
  id: StableIdSchema,
  axis: z.enum(["horizontal", "vertical"]),
  coordinate: z.number().finite(),
  locked: z.boolean(),
  visible: z.boolean(),
});

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
  guides: z.array(GuideSchema),
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
  ports: z.array(PortSchema),
  instances: z.array(InstanceSchema),
  nets: z.array(NetSchema),
  routes: z.array(RouteBranchSchema),
  junctions: z.array(JunctionSchema),
  annotations: z.array(AnnotationSchema),
  presentation: PresentationIntentSchema,
  layoutGroups: z.array(LayoutGroupSchema),
  constraints: z.array(LayoutConstraintSchema),
  noConnects: z.array(NoConnectSchema).default([]),
  // ADR 0010 drafting layer. Optional in A1a so schema-1 Projects (which have
  // no drafting container) still validate; the integration gate makes it
  // required and the migration backfills it for all loaded Projects.
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

export const SchematicDocumentSchema = SchematicDocumentBaseSchema.superRefine(
  (document, context) => {
    const objectCollections = [
      ...document.ports,
      ...document.instances,
      ...document.nets,
      ...document.routes,
      ...document.junctions,
      ...document.annotations,
      ...document.layoutGroups,
      ...document.constraints,
      ...(document.drafting?.objects ?? []),
      ...(document.drafting?.guides ?? []),
    ];
    reportDuplicateIds(objectCollections, "objects", context);

    const instanceIds = new Set(
      document.instances.map((instance) => instance.id),
    );
    const portIds = new Set(document.ports.map((port) => port.id));
    const netIds = new Set(document.nets.map((net) => net.id));
    const netById = new Map(document.nets.map((net) => [net.id, net]));
    const junctionById = new Map(
      document.junctions.map((junction) => [junction.id, junction]),
    );
    const attachableIds = new Set([
      ...document.ports.map((item) => item.id),
      ...document.instances.map((item) => item.id),
      ...document.nets.map((item) => item.id),
      ...document.routes.map((item) => item.id),
      ...document.junctions.map((item) => item.id),
    ]);
    const layoutObjectIds = new Set([
      ...attachableIds,
      ...document.annotations.map((item) => item.id),
    ]);
    const terminalNetByKey = new Map<string, string>();
    const portNetById = new Map<string, string>();

    for (const [
      annotationIndex,
      annotation,
    ] of document.annotations.entries()) {
      if (
        annotation.attachedObjectId &&
        !attachableIds.has(annotation.attachedObjectId)
      ) {
        context.addIssue({
          code: "custom",
          message: `Unknown annotation attachment: ${annotation.attachedObjectId}`,
          path: ["annotations", annotationIndex, "attachedObjectId"],
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
      const seenPorts = new Set<string>();
      for (const [portIndex, portId] of net.ports.entries()) {
        if (seenPorts.has(portId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate port on net: ${portId}`,
            path: ["nets", netIndex, "ports", portIndex],
          });
        }
        seenPorts.add(portId);
        const portOwner = portNetById.get(portId);
        if (portOwner && portOwner !== net.id) {
          context.addIssue({
            code: "custom",
            message: `Port belongs to multiple nets: ${portId}`,
            path: ["nets", netIndex, "ports", portIndex],
          });
        } else {
          portNetById.set(portId, net.id);
        }
        if (!portIds.has(portId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown port: ${portId}`,
            path: ["nets", netIndex, "ports", portIndex],
          });
        }
      }
    }

    const noConnectEndpointKeys = new Set<string>();
    for (const [noConnectIndex, noConnect] of document.noConnects.entries()) {
      const endpoint = noConnect.endpoint;
      let key: string;
      let netOwner: string | undefined;
      if (endpoint.kind === "terminal") {
        if (!instanceIds.has(endpoint.instanceId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown NoConnect terminal instance: ${endpoint.instanceId}`,
            path: ["noConnects", noConnectIndex, "endpoint", "instanceId"],
          });
        }
        key = `${endpoint.instanceId}\u0000${endpoint.pinName}`;
        netOwner = terminalNetByKey.get(key);
      } else {
        if (!portIds.has(endpoint.portId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown NoConnect port: ${endpoint.portId}`,
            path: ["noConnects", noConnectIndex, "endpoint", "portId"],
          });
        }
        key = endpoint.portId;
        netOwner = portNetById.get(endpoint.portId);
      }
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
        if (endpoint.kind === "port" && !portIds.has(endpoint.portId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown route port: ${endpoint.portId}`,
            path: ["routes", routeIndex, endpointName, "portId"],
          });
        } else if (
          endpoint.kind === "port" &&
          routeNet &&
          !routeNet.ports.includes(endpoint.portId)
        ) {
          context.addIssue({
            code: "custom",
            message: "Route port endpoint must be a member of the route net",
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
export type Point = z.infer<typeof PointSchema>;
export type Rect = z.infer<typeof RectSchema>;
export type Rotation = z.infer<typeof RotationSchema>;
export type Mirror = z.infer<typeof MirrorSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type SourcePosition = z.infer<typeof SourcePositionSchema>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export type SourceManifest = z.infer<typeof SourceManifestSchema>;
export type SymbolLibraryLock = z.infer<typeof SymbolLibraryLockSchema>;
export type SourceBindingEvidence = z.infer<typeof SourceBindingEvidenceSchema>;
export type TerminalRef = z.infer<typeof TerminalRefSchema>;
export type Instance = z.infer<typeof InstanceSchema>;
export type Port = z.infer<typeof PortSchema>;
export type Net = z.infer<typeof NetSchema>;
export type RouteEndpoint = z.infer<typeof RouteEndpointSchema>;
export type RouteBranch = z.infer<typeof RouteBranchSchema>;
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
export type RichTextDocument = z.infer<typeof RichTextDocumentSchema>;
export type RichTextRun = z.infer<typeof RichTextRunSchema>;
export type VisualAnchor = z.infer<typeof VisualAnchorSchema>;
export type Guide = z.infer<typeof GuideSchema>;
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
