import { deriveStableId } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";

import { createHierarchicalBlockGeometry } from "./hierarchical-block-geometry.js";
import { SymbolDefinitionSchema } from "./schema.js";
import type { SymbolDefinition } from "./schema.js";

export function hierarchicalSymbolId(cellName: string): string {
  return deriveStableId("hierarchical-symbol", cellName.toLowerCase());
}

export function createHierarchicalBlockSymbol(
  document: Pick<SchematicDocument, "name" | "sourceBinding" | "ports">,
): SymbolDefinition | null {
  const cellName = document.sourceBinding?.cellName;
  if (!cellName || document.ports.length === 0) return null;
  const positional = createHierarchicalBlockGeometry(document.ports.length);
  const implicitSupplyPins = document.ports
    .map((port) => port.name)
    .filter((name) => /^(?:gnd|ground|vcc|vdd|vee|vss)$/iu.test(name));
  return SymbolDefinitionSchema.parse({
    ...positional,
    id: hierarchicalSymbolId(cellName),
    name: document.name,
    pins: positional.pins.map((pin, index) => ({
      ...pin,
      name: document.ports[index]!.name,
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
  return project.documents.flatMap((document) => {
    const definition = createHierarchicalBlockSymbol(document);
    return definition ? [definition] : [];
  });
}
