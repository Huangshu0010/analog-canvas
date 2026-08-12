import type { RouteEndpoint, SourceSpan } from "@icm/model";

/**
 * Canonical Project-scoped object address (ADR 0015).
 *
 * A direct object in a Document always has `hierarchyPath: []`; a future
 * hierarchy-aware result carries the explicit parent-instance chain rather
 * than relying on a Document id alone.
 */
export type ObjectLocatorKind =
  | "document"
  | "instance"
  | "net"
  | "route"
  | "junction"
  | "terminal"
  | "port"
  | "annotation"
  | "no-connect";

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
