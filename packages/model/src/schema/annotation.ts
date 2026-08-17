import { z } from "zod";

import { PointSchema, RotationSchema, StableIdSchema } from "./common.js";
export const AnnotationKindSchema = z.enum([
  "instance-label",
  "instance-value",
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
    // Presentation-only switch: hidden annotations stay in the document
    // (recoverable) but renderers and hit surfaces skip them.
    visible: z.boolean().optional(),
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
  | { kind: "span"; style: RichTextStyle; children: RichTextRun[] }
  | {
      kind: "fraction";
      numerator: RichTextDocument;
      denominator: RichTextDocument;
    };

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
