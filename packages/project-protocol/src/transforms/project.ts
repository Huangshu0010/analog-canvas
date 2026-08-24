import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
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
