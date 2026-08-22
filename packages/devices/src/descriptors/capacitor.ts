import type { DeviceDescriptor } from "../contract.js";

export const capacitorDevice = {
  id: "capacitor",
  symbolId: "capacitor",
  deviceClass: "capacitor",
  referencePrefix: "C",
  pinOrder: ["1", "2"],
  pinSemantics: [
    { pinName: "1", role: "capacitor-top-plate" },
    { pinName: "2", role: "capacitor-bottom-plate" },
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
