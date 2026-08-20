import type { DeviceDescriptor } from "../contract.js";

export const nmosDevice = {
  id: "nmos",
  symbolId: "nmos",
  deviceClass: "mos",
  referencePrefix: "M",
  pinOrder: ["D", "G", "S", "B"],
  targetPolicy: "required-model",
  parameters: [
    {
      name: "w",
      label: "W",
      required: true,
      editor: "text",
      unitHint: "m",
      placeholder: "1u",
      help: "Channel width",
      displayRole: "width",
    },
    {
      name: "l",
      label: "L",
      required: true,
      editor: "text",
      unitHint: "m",
      placeholder: "150n",
      help: "Channel length",
      displayRole: "length",
    },
    {
      name: "m",
      label: "M",
      required: false,
      editor: "decimal",
      placeholder: "1",
      help: "Parallel multiplier",
      displayRole: "multiplier",
    },
  ],
  dialects: ["spice", "spectre"],
  capabilities: {
    supportsModel: true,
    supportsBulkBinding: true,
    supportsValueAnnotation: true,
  },
} satisfies DeviceDescriptor;
