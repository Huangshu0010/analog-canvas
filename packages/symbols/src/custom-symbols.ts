import { deriveStableId } from "@icm/model";
import type { CircuitProject, CustomSymbolDefinition } from "@icm/model";

import { createProjectHierarchicalSymbols } from "./hierarchical-block.js";
import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition } from "./schema.js";

/**
 * ADR 0047: a user-defined symbol is keyed by its definition identity, never
 * by the embedded artwork's own `symbol.id`. The derived namespace makes it
 * structurally impossible for imported artwork to shadow a catalog,
 * hierarchy, or external-subcircuit symbol.
 */
export function customSymbolId(definitionId: string): string {
  return deriveStableId("custom-symbol", definitionId);
}

/**
 * Re-key one persisted definition to its namespaced runtime symbol. The
 * embedded artwork was already validated at the persistence boundary; the
 * parse here re-checks the unchanged shape after the ID rewrite so the
 * resolver can never ingest an unvalidated definition.
 */
export function createCustomSymbol(
  definition: CustomSymbolDefinition,
): SymbolDefinition {
  return SymbolDefinitionSchema.parse({
    ...definition.symbol,
    id: customSymbolId(definition.id),
  });
}

export function createProjectCustomSymbols(
  project: Partial<Pick<CircuitProject, "customSymbolDefinitions">>,
): SymbolDefinition[] {
  return (project.customSymbolDefinitions ?? []).map(createCustomSymbol);
}

export interface CustomSymbolIdConflict {
  readonly definitionId: string;
  readonly conflictingSymbolId: string;
}

/** Project shape needed to enumerate every non-custom runtime symbol. */
type ProjectWithSymbols = Pick<CircuitProject, "documents" | "topDocumentId"> &
  Partial<
    Pick<
      CircuitProject,
      "externalSubcircuitDefinitions" | "customSymbolDefinitions"
    >
  >;

/**
 * Diagnose a custom definition whose namespaced runtime ID collides with a
 * base (catalog) symbol, a project-derived hierarchy/external symbol, or
 * another custom definition. The derived-ID scheme makes a genuine collision
 * astronomically unlikely; this check keeps a malformed input a reportable
 * diagnostic instead of a resolver crash, and gives the import UI a
 * pre-flight answer.
 */
export function findCustomSymbolIdConflicts(
  project: ProjectWithSymbols,
  baseDefinitions: readonly SymbolDefinition[],
): readonly CustomSymbolIdConflict[] {
  const occupied = new Set<string>([
    ...baseDefinitions.map((symbol) => symbol.id),
    ...createProjectHierarchicalSymbols(project, baseDefinitions).map(
      (symbol) => symbol.id,
    ),
  ]);
  const conflicts: CustomSymbolIdConflict[] = [];
  for (const definition of project.customSymbolDefinitions ?? []) {
    const runtimeId = customSymbolId(definition.id);
    if (occupied.has(runtimeId)) {
      conflicts.push({
        definitionId: definition.id,
        conflictingSymbolId: runtimeId,
      });
    }
    occupied.add(runtimeId);
  }
  return conflicts;
}
