// Schema 5 -> 6 is a continuity step retained after the abandoned visual Port
// migration was removed. It deliberately preserves ordinary Port symbol
// instances; RichText migration remains the next, independent schema step.

type Record_ = Record<string, unknown>;

/** Advances the schema without converting or replacing Port symbols. */
export function migrateV5ToV6(input: Record_): Record_ {
  return { ...input, schemaVersion: 6 };
}
