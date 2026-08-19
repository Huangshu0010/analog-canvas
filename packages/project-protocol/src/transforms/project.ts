import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

/**
 * The only active migration. Schema 14 adds optional Cell-symbol pin-label
 * placement intent; its absence preserves schema-13 geometry and electrical
 * facts exactly.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...raw,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  };
}
