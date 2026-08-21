import type { DeviceDescriptor } from "../contract.js";

export const variableResistorDevice = {
  id: "variable-resistor",
  symbolId: "variable-resistor",
  deviceClass: "resistor",
  referencePrefix: "R",
  pinOrder: ["1", "2"],
  targetPolicy: "builtin",
  parameters: [
    {
      name: "value",
      label: "Value",
      required: true,
      editor: "text",
      unitHint: "Ohm",
      placeholder: "10k",
      help: "Resistance",
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
