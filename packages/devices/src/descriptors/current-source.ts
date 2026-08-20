import type { DeviceDescriptor } from "../contract.js";

export const currentSourceDevice = {
  id: "current-source",
  symbolId: "current-source",
  deviceClass: "current-source",
  referencePrefix: "I",
  pinOrder: ["+", "-"],
  targetPolicy: "builtin",
  parameters: [
    {
      name: "dc",
      label: "Value",
      required: true,
      editor: "text",
      unitHint: "A",
      placeholder: "1m",
      help: "DC current",
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
