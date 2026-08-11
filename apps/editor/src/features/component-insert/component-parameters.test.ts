import { describe, expect, it } from "vitest";
import type { Instance } from "@icm/model";

import {
  componentParameters,
  effectiveComponentParameterValue,
  initialComponentParameterValues,
} from "./component-parameters";

describe("component parameter catalogue", () => {
  it("keeps R/L/C values as raw strings with their physical unit hints", () => {
    expect(componentParameters("resistor")).toMatchObject([
      { key: "value", help: expect.stringContaining("Ω") },
    ]);
    expect(componentParameters("capacitor")).toMatchObject([
      { key: "value", help: expect.stringContaining("F") },
    ]);
    expect(componentParameters("inductor")).toMatchObject([
      { key: "value", help: expect.stringContaining("H") },
    ]);
  });

  it("uses W, L, and M for manual MOS authoring", () => {
    expect(componentParameters("nmos").map(({ key }) => key)).toEqual([
      "w",
      "l",
      "m",
    ]);
    expect(componentParameters("pmos")).toEqual(componentParameters("nmos"));
    expect(initialComponentParameterValues("nmos")).toEqual({
      w: "",
      l: "",
      m: "",
    });
  });

  it("prefers a user override and otherwise exposes an imported source fact", () => {
    const parameter = componentParameters("nmos")[0]!;
    const instance: Instance = {
      id: "M1",
      symbolId: "nmos",
      placement: null,
      properties: { "spice.param.w": "1u" },
    };
    expect(effectiveComponentParameterValue(instance, parameter)).toBe("1u");
    instance.properties.w = "2u";
    expect(effectiveComponentParameterValue(instance, parameter)).toBe("2u");
  });
});
