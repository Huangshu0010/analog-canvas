import { z } from "zod";

import { PointSchema, RotationSchema, StableIdSchema } from "./schema.js";

// ADR 0010 WP-R4/P1: strict Zod schemas for the derived drafting geometry and
// its diagnostics, shared by the Agent Snapshot (which must not use z.unknown)
// and any consumer that validates resolved geometry. The runtime shapes are
// produced by @icm/derived resolveDraftingObjectGeometry; these schemas make
// the wire contract explicit and generated OpenAPI typed.

// Derived bounds are fractional (rich-text layout estimates), so use a
// float-tolerant rect rather than the integer RectSchema.
const FloatRectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const DraftingDiagnosticSchema = z.strictObject({
  code: z.enum([
    "DRAFTING_ANCHOR_TARGET_MISSING",
    "DRAFTING_ROUTE_SEGMENT_INVALID",
    "DRAFTING_SYMBOL_UNRESOLVED",
  ]),
  severity: z.literal("warning"),
  draftingObjectId: StableIdSchema,
  anchorRole: z.enum(["anchor", "from", "to", "target"]),
  targetObjectIds: z.array(StableIdSchema),
  message: z.string(),
  bounds: FloatRectSchema.optional(),
});

export const ResolvedDraftingGeometrySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("text"),
    position: PointSchema,
    rotation: RotationSchema,
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
  z.strictObject({
    kind: z.literal("arrow"),
    from: PointSchema,
    to: PointSchema,
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
  z.strictObject({
    kind: z.literal("leader"),
    anchor: PointSchema,
    target: PointSchema,
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
  z.strictObject({
    kind: z.literal("callout"),
    textPosition: PointSchema,
    target: PointSchema,
    rotation: RotationSchema,
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
  z.strictObject({
    kind: z.literal("construction-line"),
    points: z.array(PointSchema),
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
  z.strictObject({
    kind: z.literal("floating-symbol"),
    position: PointSchema,
    rotation: RotationSchema,
    bounds: FloatRectSchema,
    diagnostics: z.array(DraftingDiagnosticSchema),
  }),
]);
