import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import {
  deviceNetlistDefinition,
  deviceNetlistDefinitions,
  validateDeviceNetlistDefinitions,
} from "./netlist.js";

describe("reviewed device netlist definitions", () => {
  it("matches every registered definition to canonical Symbol pin order", () => {
    expect(validateDeviceNetlistDefinitions(builtInSymbols)).toEqual([]);
  });

  it("preserves hidden MOS bulk as the fourth electrical pin", () => {
    expect(deviceNetlistDefinition("nmos")).toMatchObject({
      deviceClass: "mos",
      referencePrefix: "M",
      pinOrder: ["D", "G", "S", "B"],
      targetPolicy: "required-model",
      requiredParameters: ["w", "l"],
    });
  });

  it("defines power artwork as non-emitting Net markers", () => {
    expect(deviceNetlistDefinition("ground")).toMatchObject({
      deviceClass: "net-marker",
      referencePrefix: null,
      pinOrder: ["0"],
      targetPolicy: "none",
    });
    expect(deviceNetlistDefinition("vdd")).toMatchObject({
      deviceClass: "net-marker",
      referencePrefix: null,
      pinOrder: ["P"],
      targetPolicy: "none",
    });
  });

  it("leaves unsupported catalog blocks explicit instead of guessing", () => {
    for (const symbolId of [
      "opamp",
      "voltage-amplifier",
      "ideal-switch",
      "closed-switch",
      "port",
      "port-filled",
    ]) {
      expect(deviceNetlistDefinition(symbolId)).toBeUndefined();
    }
    expect(deviceNetlistDefinitions.length).toBeGreaterThan(0);
  });
});
