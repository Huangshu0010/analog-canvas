import type { DeviceDescriptor } from "../contract.js";

export const resistorDevice = {
  id: "resistor",
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
} satisfies DeviceDescriptor;
