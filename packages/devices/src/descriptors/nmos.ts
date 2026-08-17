import type { DeviceDescriptor } from "../contract.js";

export const nmosDevice = {
  id: "nmos",
  symbolId: "nmos",
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
} satisfies DeviceDescriptor;
