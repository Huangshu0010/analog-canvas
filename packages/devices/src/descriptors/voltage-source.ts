import type { DeviceDescriptor } from "../contract.js";

export const voltageSourceDevice = {
  id: "voltage-source",
  symbolId: "voltage-source",
  deviceClass: "voltage-source",
  referencePrefix: "V",
  pinOrder: ["+", "-"],
  targetPolicy: "builtin",
  parameters: [
    {
      name: "dc",
      label: "Value",
      required: true,
      editor: "text",
      unitHint: "V",
      placeholder: "1.8",
      help: "DC voltage",
      displayRole: "value",
    },
  ],
  dialects: ["spice", "spectre"],
  capabilities: {
    supportsModel: false,
    supportsBulkBinding: false,
    supportsValueAnnotation: true,
  },
} satisfies DeviceDescriptor;
