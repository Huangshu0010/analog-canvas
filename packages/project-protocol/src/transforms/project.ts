import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The rolling migration: schema 15 separates the formerly ambiguous
 * `instance-reference` projection into an electrical designator or a
 * presentation-only schematic alias. The selected kind preserves the visible
 * v15 text exactly; no legacy binding reaches the schema-16 runtime model.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  const documents = Array.isArray(project.documents) ? project.documents : [];
  for (const rawDocument of documents) {
    if (!isRecord(rawDocument)) continue;
    const instances = Array.isArray(rawDocument.instances)
      ? rawDocument.instances
      : [];
    const instanceById = new Map<string, Record<string, unknown>>();
    for (const rawInstance of instances) {
      if (!isRecord(rawInstance) || typeof rawInstance.id !== "string")
        continue;
      instanceById.set(rawInstance.id, rawInstance);
    }
    const annotations = Array.isArray(rawDocument.annotations)
      ? rawDocument.annotations
      : [];
    for (const rawAnnotation of annotations) {
      if (!isRecord(rawAnnotation) || !isRecord(rawAnnotation.binding))
        continue;
      const binding = rawAnnotation.binding;
      if (binding.kind !== "instance-reference") continue;
      const instance =
        typeof binding.instanceId === "string"
          ? instanceById.get(binding.instanceId)
          : undefined;
      rawAnnotation.binding = {
        kind:
          instance && instance.schematicName !== undefined
            ? "instance-schematic-name"
            : "instance-designator",
        instanceId: binding.instanceId,
      };
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
