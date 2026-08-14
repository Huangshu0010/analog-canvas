import { describe, expect, it } from "vitest";

import { STARTER_SYMBOL_IDS, quickPlaceRequest } from "./shapes-panel";

describe("shapes quick-place", () => {
  it("exposes starter chips without persisting parameter placeholders", () => {
    expect(STARTER_SYMBOL_IDS).toContain("resistor");
    expect(STARTER_SYMBOL_IDS).toContain("nmos");

    const request = quickPlaceRequest("razavi", "resistor");
    expect(request).toMatchObject({
      kind: "symbol",
      symbolId: "resistor",
      symbolName: "Resistor",
      initialRotation: 0,
      showReference: true,
      referenceText: null,
    });
    expect(request?.kind === "symbol" ? request.properties.value : null).toBe(
      "",
    );
  });

  it("exposes VDD rail as a virtual Library placement", () => {
    expect(STARTER_SYMBOL_IDS).toContain("vdd");
    expect(quickPlaceRequest("razavi", "vdd")).toEqual({
      kind: "vdd-rail",
      symbolId: "vdd",
      symbolName: "VDD Rail",
    });
  });

  it("returns null for unknown symbols", () => {
    expect(quickPlaceRequest("razavi", "not-a-symbol")).toBeNull();
  });
});
