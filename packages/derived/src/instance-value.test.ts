import { describe, expect, it } from "vitest";

import { displayableInstanceValue } from "./instance-value.js";

function instance(
  symbolId: string,
  netlistParameters: Record<string, string> = {},
  properties: Record<string, string | number> = {},
) {
  return {
    id: "X1",
    symbolId,
    placement: {
      position: { x: 100, y: 100 },
      rotation: 0 as const,
      mirror: "none" as const,
    },
    properties,
    ...(Object.keys(netlistParameters).length > 0
      ? {
          netlist: {
            reference: "X1",
            binding: {
              kind: "primitive" as const,
              deviceClass: "resistor" as const,
            },
            parameters: netlistParameters,
          },
        }
      : {}),
  };
}

describe("displayableInstanceValue", () => {
  it("joins MOS width and length as one upright inline run", () => {
    const result = displayableInstanceValue(
      instance("nmos", { w: "10u", l: "0.5u" }),
    );
    expect(result).toEqual({
      kind: "displayable",
      content: { runs: [{ kind: "text", value: "10u/0.5u" }] },
    });
  });

  it("rejects a MOS device with either dimension missing", () => {
    expect(displayableInstanceValue(instance("nmos", { w: "10u" })).kind).toBe(
      "undisplayable",
    );
    expect(displayableInstanceValue(instance("pmos", { l: "0.5u" })).kind).toBe(
      "undisplayable",
    );
  });

  it("shows passive values from the netlist parameters", () => {
    expect(
      displayableInstanceValue(instance("resistor", { value: "10k" })),
    ).toEqual({
      kind: "displayable",
      content: { runs: [{ kind: "text", value: "10k" }] },
    });
    expect(
      displayableInstanceValue(instance("capacitor", { value: "2p" })),
    ).toEqual({
      kind: "displayable",
      content: { runs: [{ kind: "text", value: "2p" }] },
    });
  });

  it("shows independent source dc values", () => {
    expect(
      displayableInstanceValue(instance("voltage-source", { dc: "1.8" })),
    ).toEqual({
      kind: "displayable",
      content: { runs: [{ kind: "text", value: "1.8" }] },
    });
    expect(
      displayableInstanceValue(instance("current-source", { dc: "1m" })).kind,
    ).toBe("displayable");
  });

  it("falls back to legacy properties when netlist parameters are absent", () => {
    expect(
      displayableInstanceValue(instance("inductor", {}, { value: "3n" })),
    ).toEqual({
      kind: "displayable",
      content: { runs: [{ kind: "text", value: "3n" }] },
    });
  });

  it("reports whitespace-only or missing values as undisplayable", () => {
    expect(
      displayableInstanceValue(instance("resistor", { value: "  " })).kind,
    ).toBe("undisplayable");
    expect(displayableInstanceValue(instance("resistor")).kind).toBe(
      "undisplayable",
    );
    expect(
      displayableInstanceValue(instance("voltage-source", { value: "" })).kind,
    ).toBe("undisplayable");
  });

  it("reports unsupported device classes instead of guessing text", () => {
    expect(displayableInstanceValue(instance("npn")).kind).toBe(
      "undisplayable",
    );
    expect(displayableInstanceValue(instance("diode")).kind).toBe(
      "undisplayable",
    );
    expect(displayableInstanceValue(instance("ground")).kind).toBe(
      "undisplayable",
    );
    expect(displayableInstanceValue(instance("unknown-symbol")).kind).toBe(
      "undisplayable",
    );
  });
});
