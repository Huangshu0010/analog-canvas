// WP-R7 schema 2 -> 3 migration. Idempotent. Adds the NoConnect electrical
// record (ADR 0013 / roadmap §6.1) as an empty `noConnects` array on every
// Document and advances the schema version. The migration never infers a
// NoConnect from SPICE names (`NC`, `N/C`, `0`) or from an unconnected Pin; it
// only backfills the container. Net/Route/Junction/instance are unchanged.

const TARGET_SCHEMA_VERSION = 3;

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Migrate a schema-2 Project record to schema 3. Idempotent: a record already
 * carrying `noConnects` on every Document is returned with only the schema
 * version advanced.
 */
export function migrateV2ToV3(input: Record_): Record_ {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const migratedDocuments = documents.map((document) => {
    if (!isRecord(document)) return document;
    if (Array.isArray(document.noConnects)) return document;
    return { ...document, noConnects: [] };
  });
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: migratedDocuments,
  };
}
