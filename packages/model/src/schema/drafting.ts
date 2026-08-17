import { z } from "zod";

import {
  OrientationSchema,
  PointSchema,
  RotationSchema,
  StableIdSchema,
} from "./common.js";
import { RichTextDocumentSchema, VisualAnchorSchema } from "./annotation.js";
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
