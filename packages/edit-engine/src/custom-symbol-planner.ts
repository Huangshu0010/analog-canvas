import type { CircuitProject, CustomSymbolDefinition } from "@icm/model";

import type { ProjectStructureEdit } from "./project-transaction.js";

/** ADR 0047 caps the project-embedded custom symbol library. */
export const MAX_CUSTOM_SYMBOL_DEFINITIONS = 256;

/**
 * Plan the import or artwork replacement of one custom symbol definition.
 * Re-upserting an existing definition ID replaces the embedded artwork while
 * keeping project references stable; the runtime symbol ID is derived from the
 * definition identity, so callers never need rebinding.
 */
export function planUpsertCustomSymbolDefinition(
  project: CircuitProject,
  definition: CustomSymbolDefinition,
): ProjectStructureEdit[] {
  const isReplacement = project.customSymbolDefinitions.some(
    (candidate) => candidate.id === definition.id,
  );
  if (
    !isReplacement &&
    project.customSymbolDefinitions.length >= MAX_CUSTOM_SYMBOL_DEFINITIONS
  ) {
    throw new Error(
      `Custom symbol library is full (${MAX_CUSTOM_SYMBOL_DEFINITIONS} definitions)`,
    );
  }
  return [
    { kind: "upsert_custom_symbol_definition", definition: structuredClone(definition) },
  ];
}
