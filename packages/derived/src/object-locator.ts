import {
  RouteEndpointSchema,
  SourceSpanSchema,
  StableIdSchema,
} from "@icm/model";
import type { RouteEndpoint, SourceSpan } from "@icm/model";
import { z } from "zod";

/**
 * Canonical Project-scoped object address (ADR 0015).
 *
 * A direct object in a Document always has `hierarchyPath: []`; a future
 * hierarchy-aware result carries the explicit parent-instance chain rather
 * than relying on a Document id alone.
 */
export const ObjectLocatorKindSchema = z.enum([
  "document",
  "instance",
  "net",
  "route",
  "junction",
  "terminal",
  "port",
  "annotation",
  "no-connect",
]);
export const HierarchyFrameSchema = z.strictObject({
  parentDocumentId: StableIdSchema,
  instanceId: StableIdSchema,
  childDocumentId: StableIdSchema,
});
export const ObjectLocatorSchema = z.strictObject({
  documentId: StableIdSchema,
  hierarchyPath: z.array(HierarchyFrameSchema).max(32),
  kind: ObjectLocatorKindSchema,
  objectId: StableIdSchema,
  endpoint: RouteEndpointSchema.optional(),
  sourceRef: SourceSpanSchema.optional(),
});

export type ObjectLocatorKind = z.infer<typeof ObjectLocatorKindSchema>;
export interface HierarchyFrame {
  parentDocumentId: string;
  instanceId: string;
  childDocumentId: string;
}
export interface ObjectLocator {
  documentId: string;
  hierarchyPath: readonly HierarchyFrame[];
  kind: ObjectLocatorKind;
  objectId: string;
  endpoint?: RouteEndpoint;
  sourceRef?: SourceSpan;
}

/** Construct an unambiguous locator for an object directly in a Document. */
export function directObjectLocator<K extends ObjectLocatorKind>(
  documentId: string,
  kind: K,
  objectId: string,
): ObjectLocator & { kind: K } {
  return { documentId, hierarchyPath: [], kind, objectId };
}
