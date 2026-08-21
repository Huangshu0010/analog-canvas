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
 * Schema 21 adds the optional bounded `presentation.styleOverrides` object
 * (document-wide scale factors over the resolved style profile). A schema-20
 * Project is upgraded by stamping the current version: the new field is
 * optional and absent means the unchanged 1.0 defaults.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
