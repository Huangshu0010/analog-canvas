import type { DeviceDescriptor } from "../contract.js";

export const voltageSourceDevice = {
  id: "voltage-source",
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
} satisfies DeviceDescriptor;
