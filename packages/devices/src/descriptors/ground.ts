import type { DeviceDescriptor } from "../contract.js";

export const groundDevice = {
  id: "ground",
  symbolId: "ground",
  deviceClass: "net-marker",
  referencePrefix: null,
  pinOrder: ["0"],
  targetPolicy: "none",
  parameters: [],
  dialects: ["spice", "spectre"],
  capabilities: {
    supportsModel: false,
    supportsBulkBinding: false,
    supportsValueAnnotation: false,
  },
} satisfies DeviceDescriptor;
