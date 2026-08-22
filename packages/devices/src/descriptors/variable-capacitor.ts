import type { DeviceDescriptor } from "../contract.js";

export const variableCapacitorDevice = {
  id: "variable-capacitor",
  symbolId: "variable-capacitor",
  deviceClass: "capacitor",
  referencePrefix: "C",
  pinOrder: ["P1", "P2"],
  pinSemantics: [
    { pinName: "P1", role: "capacitor-top-plate" },
    { pinName: "P2", role: "capacitor-bottom-plate" },
  ],
  targetPolicy: "builtin",
  parameters: [
    {
      name: "value",
      label: "Value",
      required: true,
      editor: "text",
      unitHint: "F",
      placeholder: "2p",
      help: "Capacitance",
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
