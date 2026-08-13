import type { NetlistDeviceClass, StableId } from "@icm/model";

import type { SymbolDefinition } from "./schema.js";

export type DeviceNetlistTargetPolicy =
  "builtin" | "required-model" | "child-cell" | "none";

export interface DeviceNetlistDefinition {
  symbolId: StableId;
  deviceClass: NetlistDeviceClass;
  referencePrefix: string | null;
  pinOrder: readonly string[];
  targetPolicy: DeviceNetlistTargetPolicy;
  requiredParameters: readonly string[];
  dialects: readonly ["spice", "spectre"];
}

const definitions = [
  {
    symbolId: "resistor",
    deviceClass: "resistor",
    referencePrefix: "R",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
  },
  {
    symbolId: "capacitor",
    deviceClass: "capacitor",
    referencePrefix: "C",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
  },
  {
    symbolId: "inductor",
    deviceClass: "inductor",
    referencePrefix: "L",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
  },
  ...(["nmos", "pmos"] as const).map((symbolId): DeviceNetlistDefinition => ({
    symbolId,
    deviceClass: "mos",
    referencePrefix: "M",
    pinOrder: ["D", "G", "S", "B"],
    targetPolicy: "required-model",
    requiredParameters: ["w", "l"],
    dialects: ["spice", "spectre"],
  })),
  {
    symbolId: "diode",
    deviceClass: "diode",
    referencePrefix: "D",
    pinOrder: ["A", "K"],
    targetPolicy: "required-model",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
  },
  ...(["npn", "pnp"] as const).map((symbolId): DeviceNetlistDefinition => ({
    symbolId,
    deviceClass: "bjt",
    referencePrefix: "Q",
    pinOrder: ["C", "B", "E"],
    targetPolicy: "required-model",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
  })),
  {
    symbolId: "voltage-source",
    deviceClass: "voltage-source",
    referencePrefix: "V",
    pinOrder: ["+", "-"],
    targetPolicy: "builtin",
    requiredParameters: ["dc"],
    dialects: ["spice", "spectre"],
  },
  {
    symbolId: "current-source",
    deviceClass: "current-source",
    referencePrefix: "I",
    pinOrder: ["+", "-"],
    targetPolicy: "builtin",
    requiredParameters: ["dc"],
    dialects: ["spice", "spectre"],
  },
  ...(["ground", "vdd"] as const).map((symbolId): DeviceNetlistDefinition => ({
    symbolId,
    deviceClass: "net-marker",
    referencePrefix: null,
    pinOrder: [symbolId === "ground" ? "0" : "P"],
    targetPolicy: "none",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
  })),
] satisfies readonly DeviceNetlistDefinition[];

export const deviceNetlistDefinitions: readonly DeviceNetlistDefinition[] =
  definitions;

const definitionBySymbolId = new Map(
  definitions.map((definition) => [definition.symbolId, definition]),
);

export function deviceNetlistDefinition(
  symbolId: string,
): DeviceNetlistDefinition | undefined {
  return definitionBySymbolId.get(symbolId);
}

export interface DeviceNetlistDefinitionIssue {
  symbolId: string;
  message: string;
}

export function validateDeviceNetlistDefinitions(
  symbols: readonly SymbolDefinition[],
): DeviceNetlistDefinitionIssue[] {
  const issues: DeviceNetlistDefinitionIssue[] = [];
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const seen = new Set<string>();
  for (const definition of definitions) {
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
    if (
      definition.referencePrefix !== null &&
      !/^[A-Z][A-Z0-9_]*$/u.test(definition.referencePrefix)
    ) {
      issues.push({
        symbolId: definition.symbolId,
        message: `Invalid reference prefix: ${definition.referencePrefix}`,
      });
    }
    const parameterNames = new Set<string>();
    for (const parameter of definition.requiredParameters) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(parameter)) {
        issues.push({
          symbolId: definition.symbolId,
          message: `Invalid required parameter name: ${parameter}`,
        });
      } else if (parameterNames.has(parameter.toLowerCase())) {
        issues.push({
          symbolId: definition.symbolId,
          message: `Duplicate required parameter: ${parameter}`,
        });
      }
      parameterNames.add(parameter.toLowerCase());
    }
  }
  return issues;
}
