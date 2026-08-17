import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

/**
 * The only active migration. Schema 11 adds the RichText `fraction` variant;
 * every valid schema-10 value remains valid after advancing the root version.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return { ...raw, schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION };
}
