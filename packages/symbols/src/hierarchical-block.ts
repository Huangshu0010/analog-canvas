import { deriveStableId } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";

import { createHierarchicalBlockGeometry } from "./hierarchical-block-geometry.js";
import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition } from "./schema.js";

export function hierarchicalSymbolId(cellName: string): string {
  return deriveStableId("hierarchical-symbol", cellName.toLowerCase());
}

export function createHierarchicalBlockSymbol(
  document: Pick<SchematicDocument, "name" | "sourceBinding" | "netlist">,
): SymbolDefinition | null {
  const cellName = document.sourceBinding?.cellName ?? document.netlist?.name;
  const terminals = document.netlist?.terminals ?? [];
  if (!cellName) return null;
  const positional = createHierarchicalBlockGeometry(terminals.length);
  const implicitSupplyPins = terminals
    .map((terminal) => terminal.name)
    .filter((name) => /^(?:gnd|ground|vcc|vdd|vee|vss)$/iu.test(name));
  return SymbolDefinitionSchema.parse({
    ...positional,
    id: hierarchicalSymbolId(cellName),
    name: document.name,
    hierarchicalBlock: true,
    pins: positional.pins.map((pin, index) => ({
      ...pin,
      name: terminals[index]!.name,
      role: "hierarchical-port",
      presentation: {
        ...pin.presentation,
        showName: true,
      },
    })),
    variants:
      implicitSupplyPins.length === 0
        ? []
        : [
            {
              id: "implicit-supplies",
              hiddenPinNames: implicitSupplyPins,
            },
          ],
  });
}

export function createProjectHierarchicalSymbols(
  project: Pick<CircuitProject, "documents">,
): SymbolDefinition[] {
  const referencedChildIds = new Set(
    project.documents.flatMap((document) =>
      document.instances.flatMap((instance) => {
        const binding = instance.netlist?.binding;
        return binding?.kind === "subcircuit" ? [binding.childDocumentId] : [];
      }),
    ),
  );
  return project.documents.flatMap((document) => {
    if (!document.sourceBinding && !referencedChildIds.has(document.id)) {
      return [];
    }
    const definition = createHierarchicalBlockSymbol(document);
    return definition ? [definition] : [];
  });
}
