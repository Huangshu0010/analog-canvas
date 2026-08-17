import { z } from "zod";

import { PointSchema, RotationSchema, StableIdSchema } from "./common.js";
import { RichTextDocumentSchema } from "./rich-text.js";

export const VisualAnchorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("free"), position: PointSchema }),
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

export const AnnotationKindSchema = z.enum([
  "instance-label",
  "instance-value",
  "net-label",
  "power-label",
  "route-marker",
]);
export const RouteMarkerKindSchema = z.enum(["current", "voltage"]);
export const RouteAnnotationAttachmentSchema = z.strictObject({
  routeId: StableIdSchema,
  segmentIndex: z.number().int().nonnegative(),
  t: z.number().min(0).max(1),
  direction: z.enum(["forward", "reverse"]),
  normalOffset: z.number().finite(),
});
export const AnnotationSchema = z
  .strictObject({
    id: StableIdSchema,
    kind: AnnotationKindSchema,
    content: RichTextDocumentSchema,
    anchor: VisualAnchorSchema,
    netId: StableIdSchema.optional(),
    alignment: z.enum(["start", "middle", "end"]),
    rotation: RotationSchema,
    locked: z.boolean(),
    sizeScale: z.number().finite().positive().optional(),
    markerKind: RouteMarkerKindSchema.optional(),
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
