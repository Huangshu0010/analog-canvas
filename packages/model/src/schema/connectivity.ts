import { z } from "zod";

import { PointSchema, StableIdSchema } from "./common.js";
import { TerminalRefSchema } from "./instance.js";
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
