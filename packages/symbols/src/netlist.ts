import {
  builtInDeviceDescriptors,
  deviceDescriptor,
  validateDeviceDescriptors,
} from "@icm/devices";
import type {
  DeviceNetlistDefinition,
  DeviceNetlistDefinitionIssue,
} from "@icm/devices";

import type { SymbolDefinition } from "./schema.js";

export type {
  DeviceNetlistDefinition,
  DeviceNetlistDefinitionIssue,
  DeviceNetlistTargetPolicy,
} from "@icm/devices";

/** @deprecated Import from @icm/devices. */
export const deviceNetlistDefinitions: readonly DeviceNetlistDefinition[] =
  builtInDeviceDescriptors;

/** @deprecated Import from @icm/devices. */
export function deviceNetlistDefinition(
  symbolId: string,
): DeviceNetlistDefinition | undefined {
  return deviceDescriptor(symbolId);
}

export function validateDeviceNetlistDefinitions(
  symbols: readonly SymbolDefinition[],
): DeviceNetlistDefinitionIssue[] {
  const issues: DeviceNetlistDefinitionIssue[] = validateDeviceDescriptors(
    builtInDeviceDescriptors,
  );
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const seen = new Set<string>();
  for (const definition of builtInDeviceDescriptors) {
    if (seen.has(definition.symbolId)) {
      issues.push({
        symbolId: definition.symbolId,
        message: "Duplicate device netlist definition",
      });
      continue;
    }
    seen.add(definition.symbolId);
    const symbol = symbolById.get(definition.symbolId);
    if (!symbol) {
      issues.push({
        symbolId: definition.symbolId,
        message: "Device netlist definition references an unknown Symbol",
      });
      continue;
    }
    const symbolPins = symbol.pins.map((pin) => pin.name);
    if (
      symbolPins.length !== definition.pinOrder.length ||
      symbolPins.some(
        (pinName, index) => pinName !== definition.pinOrder[index],
      )
    ) {
      issues.push({
        symbolId: definition.symbolId,
        message: `Device pin order ${definition.pinOrder.join(",")} does not match canonical Symbol order ${symbolPins.join(",")}`,
      });
    }
  }
  return issues;
}
