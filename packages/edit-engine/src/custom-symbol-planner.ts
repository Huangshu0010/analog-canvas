import type { CircuitProject, CustomSymbolDefinition } from "@icm/model";
import { customSymbolId } from "@icm/symbols";

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
    {
      kind: "upsert_custom_symbol_definition",
      definition: structuredClone(definition),
    },
  ];
}

/**
 * Plan the display-name edit of one custom symbol definition. The name lives
 * inside the embedded artwork, so a rename is an artwork replacement that
 * keeps the definition identity — and therefore every placed reference —
 * untouched.
 */
export function planRenameCustomSymbol(
  project: CircuitProject,
  definitionId: string,
  name: string,
): ProjectStructureEdit[] {
  const definition = project.customSymbolDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition) {
    throw new Error(`Custom symbol definition does not exist: ${definitionId}`);
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("A custom symbol name cannot be empty");
  }
  if (trimmed === definition.symbol.name) return [];
  return planUpsertCustomSymbolDefinition(project, {
    ...definition,
    symbol: { ...definition.symbol, name: trimmed },
  });
}

/**
 * Count placed instances of one custom symbol definition across every
 * Document, so the management UI can show usage and the removal guard can
 * explain a rejection.
 */
export function customSymbolUsageCount(
  project: CircuitProject,
  definitionId: string,
): number {
  const runtimeId = customSymbolId(definitionId);
  return project.documents.reduce(
    (count, document) =>
      count +
      document.instances.filter((instance) => instance.symbolId === runtimeId)
        .length,
    0,
  );
}

/**
 * Plan the removal of one custom symbol definition. A definition still placed
 * anywhere in the project is refused here and again by the transaction
 * boundary, mirroring the external-subcircuit guard.
 */
export function planRemoveCustomSymbolDefinition(
  project: CircuitProject,
  definitionId: string,
): ProjectStructureEdit[] {
  const definition = project.customSymbolDefinitions.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition) {
    throw new Error(`Custom symbol definition does not exist: ${definitionId}`);
  }
  const usage = customSymbolUsageCount(project, definitionId);
  if (usage > 0) {
    throw new Error(
      `Custom symbol ${definition.symbol.name} is still placed ${usage} time${usage === 1 ? "" : "s"} in this project`,
    );
  }
  return [{ kind: "remove_custom_symbol_definition", definitionId }];
}
