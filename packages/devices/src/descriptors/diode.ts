import type { DeviceDescriptor } from "../contract.js";

export const diodeDevice = {
  id: "diode",
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
} satisfies DeviceDescriptor;
