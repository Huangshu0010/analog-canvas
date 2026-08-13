// Component catalog builder for the v3 Agent `snapshot` `catalog` target
// (ADR 0018 / AP1). The catalog is the single source of truth an external Agent
// uses to discover insertable product symbols without reading product source.
//
// It joins the runtime symbol library (`builtInSymbols`, the same source the GUI
// palette reads) with the netlist device definitions (`deviceNetlistDefinition`)
// that own device class, reference prefix, canonical pin order, target policy,
// and required parameters. Output is deterministically ordered.

import { builtInSymbols, deviceNetlistDefinition } from "@icm/symbols";

import { AgentCatalogSnapshotSchema } from "./schema.js";
import type { AgentCatalogSnapshot } from "./schema.js";

export interface BuildAgentCatalogSnapshotOptions {
  symbolLibrary: { id: string; version: string };
}

export function buildAgentCatalogSnapshot(
  options: BuildAgentCatalogSnapshotOptions,
): AgentCatalogSnapshot {
  const symbols = [...builtInSymbols]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((definition) => {
      const netlist = deviceNetlistDefinition(definition.id);
      return {
        id: definition.id,
        name: definition.name,
        aliases: [...definition.aliases].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
        pins: definition.pins.map((pin) => ({
          name: pin.name,
          role: pin.role,
          direction: pin.direction,
          visibility: pin.presentation.visibility,
        })),
        variants: definition.variants.map((variant) => ({
          id: variant.id,
          hiddenPinNames: [...variant.hiddenPinNames],
        })),
        decorative: definition.decorative ?? false,
        ...(netlist
          ? {
              netlist: {
                deviceClass: netlist.deviceClass,
                referencePrefix: netlist.referencePrefix,
                pinOrder: [...netlist.pinOrder],
                targetPolicy: netlist.targetPolicy,
                requiredParameters: [...netlist.requiredParameters],
              },
            }
          : {}),
      };
    });

  return AgentCatalogSnapshotSchema.parse({
    symbolLibrary: {
      id: options.symbolLibrary.id,
      version: options.symbolLibrary.version,
    },
    symbols,
  });
}
