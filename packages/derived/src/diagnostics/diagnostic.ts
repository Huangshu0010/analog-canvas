import type { ProjectConnectivityIndex } from "../connectivity-index.js";
import type { VisualDiagnostic } from "../visual.js";
import type { ErcDiagnostic, ErcLocator, ErcSeverity } from "./erc.js";

/**
 * Unified diagnostic envelope and aggregation (ADR 0015 / roadmap §5.6, WP-R9
 * data layer). Distinct producer domains — schema, spice, erc, routing, visual —
 * share one envelope so the diagnostic UI can group, filter, and navigate them
 * uniformly. Visual observations and electrical ERC never collapse into one
 * "error count": a visual observation is never proof of electrical correctness.
 */

export type DiagnosticDomain =
  "schema" | "spice" | "erc" | "routing" | "visual";

export type Diagnostic = Omit<ErcDiagnostic, "domain" | "severity"> & {
  domain: DiagnosticDomain;
  severity: ErcSeverity;
};

const SEVERITY_RANK: Record<ErcSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const DOMAIN_ORDER: readonly DiagnosticDomain[] = [
  "schema",
  "spice",
  "erc",
  "routing",
  "visual",
];

function locatorFromIndex(
  index: ProjectConnectivityIndex,
  documentId: string,
  objectId: string,
): ErcLocator {
  return (
    index.objectIndex.resolve(documentId, objectId) ?? {
      documentId,
      kind: "document",
      objectId: documentId,
    }
  );
}

/**
 * Adapt a `VisualDiagnostic` (current document-scoped observation) into the
 * unified envelope as `domain: "visual"`. Its `objectIds` are resolved to
 * `primary`/`related` locators via the project object index.
 */
export function adaptVisualDiagnostic(
  visual: VisualDiagnostic,
  documentId: string,
  index: ProjectConnectivityIndex,
): Diagnostic {
  const [primaryId, ...relatedIds] = visual.objectIds;
  const primary = primaryId
    ? locatorFromIndex(index, documentId, primaryId)
    : { documentId, kind: "document" as const, objectId: documentId };
  const related = relatedIds
    .map((objectId) => locatorFromIndex(index, documentId, objectId))
    .filter(
      (locator): locator is ErcLocator & { objectId: string } =>
        locator.objectId !== documentId || locator.kind !== "document",
    );
  return {
    id: `visual:${documentId}:${visual.code}:${primaryId ?? "doc"}`,
    domain: "visual",
    code: visual.code,
    severity: visual.severity,
    confidence: visual.confidence,
    gateEligible: visual.gateEligible,
    message: visual.message,
    primary,
    related,
    parameters: visual.parameters ?? {},
  };
}

/** Merge diagnostic groups from distinct producers into one deterministically sorted list. */
export function mergeDiagnostics(
  ...groups: readonly (readonly Diagnostic[])[]
): readonly Diagnostic[] {
  return groups
    .flat()
    .sort(
      (left, right) =>
        DOMAIN_ORDER.indexOf(left.domain) -
          DOMAIN_ORDER.indexOf(right.domain) ||
        SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
        left.primary.documentId.localeCompare(right.primary.documentId, "en") ||
        left.code.localeCompare(right.code, "en") ||
        left.primary.objectId.localeCompare(right.primary.objectId, "en"),
    );
}
