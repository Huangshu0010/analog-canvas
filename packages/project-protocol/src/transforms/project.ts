import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  deriveStableId,
  flattenRichText,
  RichTextDocumentSchema,
} from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

/**
 * Schema 22 introduces owner-addressable Connectivity Evidence. Schema-21
 * names and imported origin records are retained as transitional projections
 * while deterministic evidence is added beside them. Historical destructive
 * merge lineage cannot be reconstructed and is never fabricated here.
 */
export function upgradeSchema21To22(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  if (Array.isArray(project.documents)) {
    for (const rawDocument of project.documents) {
      if (!isRecord(rawDocument)) continue;
      const documentId =
        typeof rawDocument.id === "string" ? rawDocument.id : "document";
      const nets = Array.isArray(rawDocument.nets)
        ? rawDocument.nets.filter(isRecord)
        : [];
      const netById = new Map(
        nets.flatMap((net) =>
          typeof net.id === "string" ? [[net.id, net] as const] : [],
        ),
      );
      const evidence: Record<string, unknown>[] = [];
      for (const net of nets) {
        if (typeof net.id !== "string") continue;
        if (typeof net.name === "string" && net.name.trim()) {
          const powerDomain = legacyPowerDomain(net);
          evidence.push({
            id: evidenceId(
              documentId,
              "explicit-net-property",
              net.id,
              net.name,
            ),
            kind: "name-claim",
            netId: net.id,
            name: net.name,
            owner: { kind: "explicit-net-property" },
            scope: net.scope === "global" ? "global" : "local",
            ...(powerDomain ? { powerDomain } : {}),
          });
        }
        const origin = isRecord(net.origin) ? net.origin : null;
        if (
          origin?.kind === "spice-import" &&
          Array.isArray(origin.sourceNetIds)
        ) {
          for (const sourceNetId of origin.sourceNetIds) {
            if (typeof sourceNetId !== "string") continue;
            evidence.push({
              id: evidenceId(documentId, "spice-source", net.id, sourceNetId),
              kind: "spice-source",
              netId: net.id,
              sourceNetId,
            });
          }
        }
      }
      const annotations = Array.isArray(rawDocument.annotations)
        ? rawDocument.annotations.filter(isRecord)
        : [];
      for (const annotation of annotations) {
        if (
          (annotation.kind !== "net-label" &&
            annotation.kind !== "power-label") ||
          typeof annotation.id !== "string" ||
          typeof annotation.netId !== "string"
        ) {
          continue;
        }
        const net = netById.get(annotation.netId);
        if (!net) continue;
        const content = RichTextDocumentSchema.safeParse(annotation.content);
        const name =
          typeof net.name === "string" && net.name.trim()
            ? net.name
            : content.success
              ? flattenRichText(content.data).trim()
              : "";
        if (!name) continue;
        const powerDomain = legacyPowerDomain(net);
        const ownerKind =
          annotation.kind === "power-label" ? "power-marker" : "net-label";
        const markerObjectId =
          annotation.kind === "power-label" &&
          isRecord(annotation.anchor) &&
          annotation.anchor.kind === "object" &&
          typeof annotation.anchor.objectId === "string"
            ? annotation.anchor.objectId
            : annotation.id;
        evidence.push({
          id: evidenceId(
            documentId,
            ownerKind,
            annotation.netId,
            annotation.id,
          ),
          kind: "name-claim",
          netId: annotation.netId,
          name,
          owner:
            ownerKind === "power-marker"
              ? { kind: "power-marker", objectId: markerObjectId }
              : { kind: "net-label", annotationId: annotation.id },
          scope: net.scope === "global" ? "global" : "local",
          ...(powerDomain ? { powerDomain } : {}),
        });
      }
      rawDocument.connectivityEvidence = evidence;
    }
  }
  project.schemaVersion = 22;
  return project;
}

/**
 * Repair the narrow schema-22 shape emitted before power roles were copied
 * into Connectivity Evidence. Runtime code still reads Evidence only; this
 * load-boundary normalization merely restores information that the same file
 * already carries in its inert schema-21 Net projection.
 */
export function repairSchema22ProjectEvidence(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  if (!Array.isArray(project.documents)) return project;
  for (const rawDocument of project.documents) {
    if (!isRecord(rawDocument)) continue;
    const nets = Array.isArray(rawDocument.nets)
      ? rawDocument.nets.filter(isRecord)
      : [];
    const netById = new Map(
      nets.flatMap((net) =>
        typeof net.id === "string" ? [[net.id, net] as const] : [],
      ),
    );
    const powerLabelsById = new Map(
      (Array.isArray(rawDocument.annotations)
        ? rawDocument.annotations.filter(isRecord)
        : []
      ).flatMap((annotation) =>
        annotation.kind === "power-label" && typeof annotation.id === "string"
          ? [[annotation.id, annotation] as const]
          : [],
      ),
    );
    const evidence = Array.isArray(rawDocument.connectivityEvidence)
      ? rawDocument.connectivityEvidence.filter(isRecord)
      : [];
    for (const claim of evidence) {
      if (claim.kind !== "name-claim" || typeof claim.netId !== "string") {
        continue;
      }
      const net = netById.get(claim.netId);
      const powerDomain = net ? legacyPowerDomain(net) : undefined;
      if (
        powerDomain &&
        claim.powerDomain === undefined &&
        typeof claim.name === "string" &&
        typeof net?.name === "string" &&
        claim.name.trim() === net.name.trim()
      ) {
        claim.powerDomain = powerDomain;
      }
      const owner = isRecord(claim.owner) ? claim.owner : null;
      if (
        owner?.kind === "net-label" &&
        typeof owner.annotationId === "string" &&
        powerLabelsById.has(owner.annotationId)
      ) {
        const annotation = powerLabelsById.get(owner.annotationId);
        const anchor = isRecord(annotation?.anchor) ? annotation.anchor : null;
        claim.owner = {
          kind: "power-marker",
          objectId:
            anchor?.kind === "object" && typeof anchor.objectId === "string"
              ? anchor.objectId
              : owner.annotationId,
        };
      } else if (
        owner?.kind === "power-marker" &&
        typeof owner.objectId === "string" &&
        powerLabelsById.has(owner.objectId)
      ) {
        const annotation = powerLabelsById.get(owner.objectId);
        const anchor = isRecord(annotation?.anchor) ? annotation.anchor : null;
        if (anchor?.kind === "object" && typeof anchor.objectId === "string") {
          claim.owner = { kind: "power-marker", objectId: anchor.objectId };
        }
      }
    }
  }
  return project;
}

/** Schema 23 makes Base Nets purely physical; Evidence owns every logical fact. */
export function upgradeSchema22To23(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = repairSchema22ProjectEvidence(raw);
  return canonicalizeSchema23Project(project);
}

/** Remove convergence-only projections from an already-versioned schema-23 input. */
export function canonicalizeSchema23Project(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  if (Array.isArray(project.documents)) {
    for (const rawDocument of project.documents) {
      if (!isRecord(rawDocument) || !Array.isArray(rawDocument.nets)) continue;
      for (const rawNet of rawDocument.nets) {
        if (!isRecord(rawNet)) continue;
        delete rawNet.name;
        delete rawNet.scope;
        delete rawNet.powerDomain;
        delete rawNet.origin;
      }
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}

function legacyPowerDomain(
  net: Record<string, unknown>,
): "vdd" | "ground" | undefined {
  return net.powerDomain === "vdd" || net.powerDomain === "ground"
    ? net.powerDomain
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function evidenceId(
  documentId: string,
  kind: string,
  netId: string,
  ownerId: string,
): string {
  return deriveStableId(
    "connectivity-evidence",
    documentId,
    kind,
    netId,
    ownerId,
  );
}
