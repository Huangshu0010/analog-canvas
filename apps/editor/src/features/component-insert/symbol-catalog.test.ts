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
  });

  it("searches names, ids, and aliases without exposing retired MOS entries", () => {
    const symbols = flattenComponentCatalog(
      componentCatalog("razavi-textbook-v1", "nmos"),
    );

    expect(symbols.map((symbol) => symbol.id)).toContain("nmos");
    expect(symbols.map((symbol) => symbol.id)).not.toContain("nmos3");
    expect(findPaletteSymbol("razavi-textbook-v1", "pmos3")).toBeUndefined();
  });

  it("returns no selectable entries for an unmatched query", () => {
    expect(
      flattenComponentCatalog(
        componentCatalog("razavi-textbook-v1", "does-not-exist"),
      ),
    ).toEqual([]);
  });
});
