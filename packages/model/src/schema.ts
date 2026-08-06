import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

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
export const InstanceSchema = z.strictObject({
  id: StableIdSchema,
  symbolId: StableIdSchema,
  symbolVariantId: StableIdSchema.optional(),
  sourceRef: SourceSpanSchema.optional(),
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
export const JunctionSchema = z.strictObject({
  id: StableIdSchema,
  netId: StableIdSchema,
  position: PointSchema,
});

export const AnnotationSchema = z.strictObject({
  id: StableIdSchema,
  kind: z.enum([
    "instance-label",
    "net-label",
    "power-label",
    "plain-text",
    "current",
    "voltage",
    "figure-caption",
  ]),
  text: z.string(),
  position: PointSchema,
  attachedObjectId: StableIdSchema.optional(),
  offset: PointSchema,
  alignment: z.enum(["start", "middle", "end"]),
  rotation: RotationSchema,
  locked: z.boolean(),
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
export type TerminalRef = z.infer<typeof TerminalRefSchema>;
export type Instance = z.infer<typeof InstanceSchema>;
export type Port = z.infer<typeof PortSchema>;
export type Net = z.infer<typeof NetSchema>;
export type RouteEndpoint = z.infer<typeof RouteEndpointSchema>;
export type RouteBranch = z.infer<typeof RouteBranchSchema>;
export type Junction = z.infer<typeof JunctionSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type PresentationIntent = z.infer<typeof PresentationIntentSchema>;
export type LayoutGroup = z.infer<typeof LayoutGroupSchema>;
export type LayoutConstraint = z.infer<typeof LayoutConstraintSchema>;
export type SchematicDocument = z.infer<typeof SchematicDocumentSchema>;
export type CircuitProject = z.infer<typeof CircuitProjectSchema>;
