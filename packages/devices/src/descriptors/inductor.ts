import type { DeviceDescriptor } from "../contract.js";

export const inductorDevice = {
  id: "inductor",
  symbolId: "inductor",
  deviceClass: "inductor",
  referencePrefix: "L",
  pinOrder: ["1", "2"],
  targetPolicy: "builtin",
  parameters: [
    {
      name: "value",
      label: "Value",
      required: true,
      editor: "text",
      unitHint: "H",
      placeholder: "3n",
      help: "Inductance",
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
