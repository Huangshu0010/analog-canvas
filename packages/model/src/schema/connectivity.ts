import { z } from "zod";

import { StableIdSchema } from "./common.js";
import { TerminalRefSchema } from "./instance.js";
import { SourceSpanSchema } from "./source.js";

export const NetPowerDomainSchema = z.enum([
  "none",
  "vdd",
  "ground",
  "conflict",
]);
/**
 * Identifies the topology authority that may request routing guidance. The
 * absence of this optional field is treated as authored only while opening
 * legacy in-memory Documents; schema-19 writers persist it explicitly.
 */
export const NetOriginSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("authored") }),
  z.strictObject({
    kind: z.literal("spice-import"),
    sourceNetIds: z.array(StableIdSchema).min(1).max(256),
  }),
]);
export const NetSchema = z.strictObject({
  id: StableIdSchema,
  name: z.string().min(1).optional(),
  scope: z.enum(["local", "global"]),
  // Runtime treats absence as `none` for in-memory construction and never
  // infers power identity from a symbol, name, or fixed Net ID.
  powerDomain: NetPowerDomainSchema.optional(),
  terminals: z.array(TerminalRefSchema),
  origin: NetOriginSchema.optional(),
});

export const ConnectivityNameClaimOwnerSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("net-label"),
    annotationId: StableIdSchema,
  }),
  z.strictObject({
    kind: z.literal("free-port"),
    instanceId: StableIdSchema,
  }),
  z.strictObject({
    kind: z.literal("power-marker"),
    objectId: StableIdSchema,
  }),
  z.strictObject({ kind: z.literal("explicit-net-property") }),
]);

/** Persisted reason why Base Nets participate in one logical connectivity. */
export const ConnectivityEvidenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: StableIdSchema,
    kind: z.literal("name-claim"),
    netId: StableIdSchema,
    name: z.string().trim().min(1).max(256),
    owner: ConnectivityNameClaimOwnerSchema,
    scope: z.enum(["local", "global"]),
  }),
  z.strictObject({
    id: StableIdSchema,
    kind: z.literal("spice-source"),
    netId: StableIdSchema,
    sourceNetId: StableIdSchema,
    sourceRef: SourceSpanSchema.optional(),
  }),
  z.strictObject({
    id: StableIdSchema,
    kind: z.literal("explicit-equivalence"),
    memberNetIds: z.array(StableIdSchema).min(2).max(256),
  }),
]);

// ADR 0013 / WP-R7 NoConnect: explicit electrical declaration for an open Pin.
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
