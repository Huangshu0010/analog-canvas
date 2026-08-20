import { deriveStableId } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";

import { createHierarchicalBlockGeometry } from "./hierarchical-block-geometry.js";
import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition } from "./schema.js";

export function hierarchicalSymbolId(cellName: string): string {
  return deriveStableId("hierarchical-symbol", cellName.toLowerCase());
}

export function externalSubcircuitSymbolId(targetName: string): string {
  return deriveStableId("external-subcircuit-symbol", targetName.toLowerCase());
}

export function createHierarchicalBlockSymbol(
  document: Pick<SchematicDocument, "name" | "sourceBinding" | "netlist"> & {
    readonly presentation?: SchematicDocument["presentation"];
  },
): SymbolDefinition | null {
  const cellName = document.sourceBinding?.cellName ?? document.netlist?.name;
  const terminals = document.netlist?.terminals ?? [];
  if (!cellName) return null;
  const positional = createHierarchicalBlockGeometry(
    terminals,
    document.presentation?.cellSymbol,
  );
  return SymbolDefinitionSchema.parse({
    ...positional,
    id: hierarchicalSymbolId(cellName),
    name: document.name,
    hierarchicalBlock: true,
    pins: positional.pins,
    variants: [],
  });
}

export function createProjectHierarchicalSymbols(
  project: Pick<CircuitProject, "documents" | "topDocumentId"> &
    Partial<Pick<CircuitProject, "externalSubcircuitDefinitions">>,
): SymbolDefinition[] {
  const referencedChildIds = new Set(
    project.documents.flatMap((document) =>
      document.instances.flatMap((instance) => {
        const binding = instance.netlist?.binding;
        return binding?.kind === "subcircuit" ? [binding.childDocumentId] : [];
      }),
    ),
  );
  const internal = project.documents.flatMap((document) => {
    if (
      document.id === project.topDocumentId &&
      !document.sourceBinding &&
      !referencedChildIds.has(document.id)
    ) {
      return [];
    }
    const definition = createHierarchicalBlockSymbol(document);
    return definition ? [definition] : [];
  });
  const referencedExternalIds = new Set(
    project.documents.flatMap((document) =>
      document.instances.flatMap((instance) => {
        const binding = instance.netlist?.binding;
        return binding?.kind === "external-subcircuit"
          ? [binding.definitionId]
          : [];
      }),
    ),
  );
  const external = (project.externalSubcircuitDefinitions ?? []).flatMap(
    (definition) => {
      if (!referencedExternalIds.has(definition.id)) return [];
      const positional = createHierarchicalBlockGeometry(
        definition.terminals.map((terminal, index) => ({
          id: `${definition.id}:terminal:${index}`,
          name: terminal.name,
          direction: "passive" as const,
        })),
      );
      return [
        SymbolDefinitionSchema.parse({
          ...positional,
          id: externalSubcircuitSymbolId(definition.name),
          name: definition.name,
          hierarchicalBlock: true,
          pins: positional.pins,
          variants: [],
        }),
      ];
    },
  );
  return [...internal, ...external];
}
