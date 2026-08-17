import type { DeviceDescriptor } from "../contract.js";

export const pnpDevice = {
  id: "pnp",
  symbolId: "pnp",
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
} satisfies DeviceDescriptor;
