import { describe, expect, it } from "vitest";

import {
  componentCatalog,
  findPaletteSymbol,
  flattenComponentCatalog,
  symbolCategory,
} from "./symbol-catalog";

describe("component insertion catalog", () => {
  it("keeps categories stable while promoting recent symbols within them", () => {
    const groups = componentCatalog("razavi-textbook-v1", "", [
      "capacitor",
      "resistor",
    ]);
    const passives = groups.find((group) => group.category === "Passives");

    expect(passives?.symbols.slice(0, 2).map((symbol) => symbol.id)).toEqual([
      "capacitor",
      "resistor",
    ]);
    expect(symbolCategory("capacitor")).toBe("Passives");
    expect(symbolCategory("variable-resistor")).toBe("Passives");
    expect(symbolCategory("opamp")).toBe("Analog Blocks");
    expect(symbolCategory("npn")).toBe("Transistors");
    expect(symbolCategory("diode")).toBe("Passives");
    expect(symbolCategory("ideal-switch")).toBe("Switches");
    expect(symbolCategory("closed-switch")).toBe("Switches");
  });

  it("offers the two-terminal variable resistor as a searchable passive", () => {
    const symbols = flattenComponentCatalog(
      componentCatalog("razavi-textbook-v1", "variable resistor"),
    );

    expect(symbols.map((symbol) => symbol.id)).toEqual(["variable-resistor"]);
    expect(symbols[0]?.pins.map((pin) => pin.name)).toEqual(["P1", "P2"]);
  });

  it("searches canonical names and ids without exposing retired MOS entries", () => {
    const symbols = flattenComponentCatalog(
      componentCatalog("razavi-textbook-v1", "nmos"),
    );

    expect(symbols.map((symbol) => symbol.id)).toContain("nmos");
    expect(symbols.map((symbol) => symbol.id)).not.toContain("nmos3");
    expect(findPaletteSymbol("razavi-textbook-v1", "pmos3")).toBeUndefined();
  });

  it("never exposes removed compatibility symbols under another style profile", () => {
    const symbols = flattenComponentCatalog(componentCatalog("unknown", ""));
    expect(symbols.map((symbol) => symbol.id)).toEqual(
      expect.arrayContaining(["nmos", "pmos", "resistor", "capacitor"]),
    );
    expect(symbols.map((symbol) => symbol.id)).toContain("inductor");
    expect(symbols.map((symbol) => symbol.id)).toContain("opamp");
    expect(symbols.map((symbol) => symbol.id)).toEqual(
      expect.arrayContaining(["diode", "npn", "pnp"]),
    );
    expect(symbols.map((symbol) => symbol.id)).not.toContain("transformer");
    expect(symbols.map((symbol) => symbol.id)).not.toContain("vccs");
  });

  it("returns no selectable entries for an unmatched query", () => {
    expect(
      flattenComponentCatalog(
        componentCatalog("razavi-textbook-v1", "does-not-exist"),
      ),
    ).toEqual([]);
  });
});
