import type { DeviceDescriptor } from "./contract.js";

const definitions = [
  {
    symbolId: "resistor",
    deviceClass: "resistor",
    referencePrefix: "R",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  {
    symbolId: "capacitor",
    deviceClass: "capacitor",
    referencePrefix: "C",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  {
    symbolId: "inductor",
    deviceClass: "inductor",
    referencePrefix: "L",
    pinOrder: ["1", "2"],
    targetPolicy: "builtin",
    requiredParameters: ["value"],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  ...(["nmos", "pmos"] as const).map(
    (symbolId): DeviceDescriptor => ({
      symbolId,
      deviceClass: "mos",
      referencePrefix: "M",
      pinOrder: ["D", "G", "S", "B"],
      targetPolicy: "required-model",
      requiredParameters: ["w", "l"],
      dialects: ["spice", "spectre"],
      capabilities: {
        supportsModel: true,
        supportsBulkBinding: true,
        supportsValueAnnotation: true,
      },
    }),
  ),
  {
    symbolId: "diode",
    deviceClass: "diode",
    referencePrefix: "D",
    pinOrder: ["A", "K"],
    targetPolicy: "required-model",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: true,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  ...(["npn", "pnp"] as const).map(
    (symbolId): DeviceDescriptor => ({
      symbolId,
      deviceClass: "bjt",
      referencePrefix: "Q",
      pinOrder: ["C", "B", "E"],
      targetPolicy: "required-model",
      requiredParameters: [],
      dialects: ["spice", "spectre"],
      capabilities: {
        supportsModel: true,
        supportsBulkBinding: false,
        supportsValueAnnotation: true,
      },
    }),
  ),
  {
    symbolId: "voltage-source",
    deviceClass: "voltage-source",
    referencePrefix: "V",
    pinOrder: ["+", "-"],
    targetPolicy: "builtin",
    requiredParameters: ["dc"],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  {
    symbolId: "current-source",
    deviceClass: "current-source",
    referencePrefix: "I",
    pinOrder: ["+", "-"],
    targetPolicy: "builtin",
    requiredParameters: ["dc"],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: true,
    },
  },
  {
    symbolId: "ground",
    deviceClass: "net-marker",
    referencePrefix: null,
    pinOrder: ["0"],
    targetPolicy: "none",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: false,
    },
  },
  {
    symbolId: "vdd-port",
    deviceClass: "net-marker",
    referencePrefix: null,
    pinOrder: ["P"],
    targetPolicy: "none",
    requiredParameters: [],
    dialects: ["spice", "spectre"],
    capabilities: {
      supportsModel: false,
      supportsBulkBinding: false,
      supportsValueAnnotation: false,
    },
  },
] satisfies readonly DeviceDescriptor[];

export const builtInDeviceDescriptors: readonly DeviceDescriptor[] =
  definitions;

const descriptorBySymbolId = new Map(
  definitions.map((definition) => [definition.symbolId, definition]),
);

export function deviceDescriptor(
  symbolId: string,
): DeviceDescriptor | undefined {
  return descriptorBySymbolId.get(symbolId);
}
