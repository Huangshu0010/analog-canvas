import type { DeviceDescriptor } from "../contract.js";

export const currentSourceDevice = {
  id: "current-source",
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
} satisfies DeviceDescriptor;
