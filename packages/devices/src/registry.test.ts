import { describe, expect, it } from "vitest";

import {
  builtInDeviceDescriptors,
  deviceDescriptor,
  deviceDescriptorById,
  validateDeviceDescriptors,
} from "./index.js";

describe("built-in device registry", () => {
  it("contains internally valid, uniquely identified descriptors", () => {
    expect(validateDeviceDescriptors(builtInDeviceDescriptors)).toEqual([]);
    expect(deviceDescriptorById("nmos")).toBe(deviceDescriptor("nmos"));
  });

  it("preserves MOS electrical and netlist behavior", () => {
    expect(deviceDescriptor("nmos")).toMatchObject({
      deviceClass: "mos",
      referencePrefix: "M",
      pinOrder: ["D", "G", "S", "B"],
      targetPolicy: "required-model",
      requiredParameters: ["w", "l"],
      capabilities: { supportsBulkBinding: true },
    });
  });

  it("keeps reviewed net markers non-emitting", () => {
    expect(deviceDescriptor("ground")).toMatchObject({
      deviceClass: "net-marker",
      referencePrefix: null,
      pinOrder: ["0"],
      targetPolicy: "none",
    });
    expect(deviceDescriptor("vdd-port")).toMatchObject({
      deviceClass: "net-marker",
      referencePrefix: null,
      pinOrder: ["P"],
      targetPolicy: "none",
    });
  });

  it("rejects descriptor capability claims that would change device meaning", () => {
    const nmos = deviceDescriptor("nmos");
    expect(nmos).toBeDefined();
    if (!nmos) return;
    expect(
      validateDeviceDescriptors([
        {
          ...nmos,
          id: "invalid-bulk-device",
          symbolId: "invalid-bulk-device",
          deviceClass: "resistor",
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Only MOS devices may support bulk binding",
        }),
      ]),
    );
  });
});
