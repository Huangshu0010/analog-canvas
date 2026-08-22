import { describe, expect, it } from "vitest";

import {
  differentialOutputSibling,
  planDifferentialOutputSwap,
} from "./differential-output-swap";

describe("differential output swap", () => {
  it("pairs the two output arrangements and nothing else", () => {
    expect(differentialOutputSibling("opamp-differential")).toBe(
      "opamp-differential-crossed",
    );
    expect(differentialOutputSibling("opamp-differential-crossed")).toBe(
      "opamp-differential",
    );
    expect(differentialOutputSibling("opamp")).toBeUndefined();
    expect(differentialOutputSibling("resistor")).toBeUndefined();
  });

  it("swaps by exchanging Symbols so terminal names survive", () => {
    expect(planDifferentialOutputSwap("X1", "opamp-differential")).toEqual([
      {
        kind: "set_instance_symbol",
        instanceId: "X1",
        symbolId: "opamp-differential-crossed",
      },
    ]);
    expect(planDifferentialOutputSwap("X1", "opamp")).toEqual([]);
  });
});
