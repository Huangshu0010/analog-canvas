import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import { InMemorySymbolResolver } from "./resolver.js";
import { SymbolDefinitionSchema } from "./schema.js";

describe("initial built-in Symbol Library", () => {
  it("contains the reviewed Phase 5 production families", () => {
    expect(builtInSymbols.map((symbol) => symbol.id)).toEqual([
      "resistor",
      "capacitor",
      "inductor",
      "nmos",
      "pmos",
      "ground",
      "vdd",
      "vss",
      "port",
      "voltage-source",
      "current-source",
      "diode",
      "npn",
      "pnp",
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
    expect(nmos?.variant?.hiddenPrimitiveParts).toEqual(["bulk-lead"]);
  });

  it("matches the reviewed electrical pins from the owned VSS manifest", () => {
    const review = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "fixtures/symbols/circuit-vss-review.json"),
        "utf8",
      ),
    ) as { mappings: Array<{ symbolId: string; pins: string[] }> };
    const byId = new Map(builtInSymbols.map((symbol) => [symbol.id, symbol]));
    for (const mapping of review.mappings) {
      expect(byId.get(mapping.symbolId)?.pins.map((pin) => pin.name)).toEqual(
        mapping.pins,
      );
    }
  });
});
