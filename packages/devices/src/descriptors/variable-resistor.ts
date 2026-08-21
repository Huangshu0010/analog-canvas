import type { DeviceDescriptor } from "../contract.js";

export const variableResistorDevice = {
  id: "variable-resistor",
  symbolId: "variable-resistor",
  deviceClass: "resistor",
  referencePrefix: "X",
  pinOrder: ["P1", "P2"],
  targetPolicy: "child-cell",
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
