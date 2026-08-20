import type { DeviceDescriptor } from "../contract.js";

export const capacitorDevice = {
  id: "capacitor",
  symbolId: "capacitor",
  deviceClass: "capacitor",
  referencePrefix: "C",
  pinOrder: ["1", "2"],
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
