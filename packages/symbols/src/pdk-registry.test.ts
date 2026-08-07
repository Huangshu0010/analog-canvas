import { describe, expect, it } from "vitest";

import { resolvePdkSymbolMapping } from "./pdk-registry.js";

describe("PDK symbol mapping registry", () => {
  it("maps reviewed SKY130 MOS namespaces with explicit pin order", () => {
    expect(resolvePdkSymbolMapping("sky130_fd_pr__nfet_01v8", 4)).toEqual({
      symbolId: "nmos",
      pinNames: ["D", "G", "S", "B"],
      source: "pdk-rule",
      registryId: "sky130-nfet-four-terminal",
    });
    expect(
      resolvePdkSymbolMapping("SKY130_FD_PR__PFET_G5V0D10V5", 4),
    ).toMatchObject({ symbolId: "pmos", pinNames: ["D", "G", "S", "B"] });
    expect(resolvePdkSymbolMapping("sky130_fd_pr__res_high_po", 3)).toEqual({
      symbolId: "poly-resistor",
      pinNames: ["1", "2", "B"],
      source: "pdk-rule",
      registryId: "sky130-high-po-three-terminal",
    });
  });

  it("does not guess an unknown namespace or conflicting terminal count", () => {
    expect(
      resolvePdkSymbolMapping("unknown_fd_pr__nfet_01v8", 4),
    ).toBeUndefined();
    expect(
      resolvePdkSymbolMapping("sky130_fd_pr__nfet_01v8", 3),
    ).toBeUndefined();
  });

  it("gives an explicit exact override priority over a PDK namespace rule", () => {
    expect(
      resolvePdkSymbolMapping("sky130_fd_pr__nfet_01v8", 4, [
        {
          modelName: "sky130_fd_pr__nfet_01v8",
          terminalCount: 4,
          symbolId: "generic-block-4",
          pinNames: ["P1", "P2", "P3", "P4"],
          registryId: "project-reviewed-special-device",
        },
      ]),
    ).toEqual({
      symbolId: "generic-block-4",
      pinNames: ["P1", "P2", "P3", "P4"],
      registryId: "project-reviewed-special-device",
      source: "exact",
    });
  });
});
