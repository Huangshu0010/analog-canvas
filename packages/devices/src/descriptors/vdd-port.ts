import type { DeviceDescriptor } from "../contract.js";

export const vddPortDevice = {
  id: "vdd-port",
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
} satisfies DeviceDescriptor;
