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
      "nmos3",
      "pmos3",
      "ground",
      "vdd",
      "vss",
      "port",
      "voltage-source",
      "current-source",
      "ac-voltage-source",
      "pulse-voltage-source",
      "diode",
      "zener",
      "schottky",
      "led",
      "npn",
      "pnp",
      "opamp",
      "switch-open",
      "switch-closed",
      "crystal",
      "transformer",
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

  it("distinguishes reviewed NMOS and PMOS artwork by bulk-arrow direction", () => {
    const nmos = builtInSymbols.find((symbol) => symbol.id === "nmos")!;
    const pmos = builtInSymbols.find((symbol) => symbol.id === "pmos")!;
    expect(
      nmos.primitives.some((primitive) => primitive.kind === "circle"),
    ).toBe(false);
    expect(
      pmos.primitives.some((primitive) => primitive.kind === "circle"),
    ).toBe(false);
    const nmosArrow = nmos.primitives.find(
      (primitive) => primitive.kind === "polygon",
    );
    const pmosArrow = pmos.primitives.find(
      (primitive) => primitive.kind === "polygon",
    );
    expect(nmosArrow?.kind === "polygon" ? nmosArrow.points[0]?.x : null).toBe(
      -2,
    );
    expect(pmosArrow?.kind === "polygon" ? pmosArrow.points[0]?.x : null).toBe(
      16,
    );
  });

  it("matches the reviewed electrical pins from the owned VSS manifest", () => {
    const review = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "fixtures/symbols/circuit-vss-review.json"),
        "utf8",
      ),
    ) as {
      mappings: Array<{ symbolId: string; pins: string[] }>;
      migrationCandidates: Array<{
        symbolId: string;
        provisionalPins: string[];
        status: string;
      }>;
    };
    const byId = new Map(builtInSymbols.map((symbol) => [symbol.id, symbol]));
    for (const mapping of review.mappings) {
      expect(byId.get(mapping.symbolId)?.pins.map((pin) => pin.name)).toEqual(
        mapping.pins,
      );
    }
    for (const candidate of review.migrationCandidates) {
      expect(candidate.status).toBe("geometry-migrated-pin-review-required");
      expect(byId.get(candidate.symbolId)?.pins.map((pin) => pin.name)).toEqual(
        candidate.provisionalPins,
      );
    }
  });
});
