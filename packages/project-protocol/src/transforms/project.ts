import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

/**
 * The only active migration. Schema 13 adds optional derived Cell-symbol
 * presentation intent; an absent member selects deterministic automatic
 * geometry and preserves every schema-12 electrical fact exactly.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...raw,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  };
}
