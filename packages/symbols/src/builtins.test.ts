import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import { InMemorySymbolResolver } from "./resolver.js";
import { SymbolDefinitionSchema } from "./schema.js";

describe("initial built-in Symbol Library", () => {
  it("contains the eight Phase 1 symbol families", () => {
    expect(builtInSymbols.map((symbol) => symbol.id)).toEqual([
      "resistor",
      "capacitor",
      "inductor",
      "nmos",
      "pmos",
      "ground",
      "port",
      "generic-block",
    ]);
    for (const symbol of builtInSymbols) {
      expect(SymbolDefinitionSchema.parse(symbol)).toEqual(symbol);
    }
  });

  it("preserves MOS electrical bulk pins in textbook variants", () => {
    const resolver = new InMemorySymbolResolver(builtInSymbols);
    const nmos = resolver.resolve("nmos", "textbook-3terminal");
    expect(nmos?.definition.pins.map((pin) => pin.name)).toEqual([
      "D",
      "G",
      "S",
      "B",
    ]);
    expect(nmos?.variant?.hiddenPinNames).toEqual(["B"]);
  });
});
