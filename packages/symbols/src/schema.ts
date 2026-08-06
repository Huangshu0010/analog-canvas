import { PointSchema, RectSchema, StableIdSchema } from "@icm/model";
import { z } from "zod";

export const SymbolPinSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string().min(1),
  at: PointSchema,
  direction: z.enum(["north", "east", "south", "west"]),
  presentation: z.strictObject({
    visibility: z.enum(["visible", "implicit", "conditional"]),
    leadLength: z.number().int().nonnegative().optional(),
    showName: z.boolean().optional(),
  }),
});
export const SymbolPrimitiveSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("line"),
    from: PointSchema,
    to: PointSchema,
  }),
  z.strictObject({
    kind: z.literal("polyline"),
    points: z.array(PointSchema).min(2),
  }),
  z.strictObject({
    kind: z.literal("circle"),
    center: PointSchema,
    radius: z.number().positive(),
  }),
  z.strictObject({ kind: z.literal("path"), data: z.string().min(1) }),
]);
export const SymbolVariantSchema = z.strictObject({
  id: StableIdSchema,
  hiddenPinNames: z.array(z.string().min(1)),
});
export const SymbolDefinitionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: StableIdSchema,
    name: z.string().min(1),
    viewBox: RectSchema,
    pins: z.array(SymbolPinSchema).min(1),
    primitives: z.array(SymbolPrimitiveSchema),
    variants: z.array(SymbolVariantSchema),
    aliases: z.array(StableIdSchema),
  })
  .superRefine((symbol, context) => {
    const pinNames = new Set<string>();
    for (const [pinIndex, pin] of symbol.pins.entries()) {
      if (pinNames.has(pin.name)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate symbol pin: ${pin.name}`,
          path: ["pins", pinIndex, "name"],
        });
      }
      pinNames.add(pin.name);
    }
    const variantIds = new Set<string>();
    for (const [variantIndex, variant] of symbol.variants.entries()) {
      if (variantIds.has(variant.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate symbol variant: ${variant.id}`,
          path: ["variants", variantIndex, "id"],
        });
      }
      variantIds.add(variant.id);
      for (const [pinIndex, pinName] of variant.hiddenPinNames.entries()) {
        if (!pinNames.has(pinName)) {
          context.addIssue({
            code: "custom",
            message: `Variant hides an unknown electrical pin: ${pinName}`,
            path: ["variants", variantIndex, "hiddenPinNames", pinIndex],
          });
        }
      }
    }
  });

export const SymbolDefinitionJsonSchema = z.toJSONSchema(
  SymbolDefinitionSchema,
  {
    target: "draft-2020-12",
  },
);

export type SymbolPin = z.infer<typeof SymbolPinSchema>;
export type SymbolPrimitive = z.infer<typeof SymbolPrimitiveSchema>;
export type SymbolVariant = z.infer<typeof SymbolVariantSchema>;
export type SymbolDefinition = z.infer<typeof SymbolDefinitionSchema>;
