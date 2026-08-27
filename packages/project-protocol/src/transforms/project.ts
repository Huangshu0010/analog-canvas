import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

/**
 * The rolling compatibility window is deliberately explicit. Advancing the
 * current schema replaces this adapter instead of extending a migration chain.
 *
 * ADR 0047: schema 26 adds optional `customSymbolDefinitions`. The adapter
 * only advances the version and defaults the new array to empty; the schema-24
 * Cell Pin migration retired when schema 24 left the window.
 */
export function upgradeSchema25To26(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  if (project.customSymbolDefinitions === undefined) {
    project.customSymbolDefinitions = [];
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
