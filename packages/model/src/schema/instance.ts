import { z } from "zod";

import {
  MirrorSchema,
  PointSchema,
  RotationSchema,
  StableIdSchema,
} from "./common.js";
import { SourceSpanSchema } from "./source.js";
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
