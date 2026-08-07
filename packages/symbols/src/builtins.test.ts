import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { transformPoint } from "@icm/model";
import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import { InMemorySymbolResolver } from "./resolver.js";
import { SYMBOL_CONNECTION_GRID, SymbolDefinitionSchema } from "./schema.js";

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

  it("keeps every electrical pin on the canonical connection grid", () => {
    for (const symbol of builtInSymbols) {
      for (const pin of symbol.pins) {
        expect(
          {
            symbolId: symbol.id,
            pinName: pin.name,
            xRemainder: Math.abs(pin.at.x % SYMBOL_CONNECTION_GRID),
            yRemainder: Math.abs(pin.at.y % SYMBOL_CONNECTION_GRID),
          },
          `${symbol.id}.${pin.name} must land on the connection grid`,
        ).toMatchObject({ xRemainder: 0, yRemainder: 0 });
      }
    }
  });

  it("rejects a symbol whose pin anchor is between connection-grid points", () => {
    const resistor = builtInSymbols.find((symbol) => symbol.id === "resistor")!;
    const parsed = SymbolDefinitionSchema.safeParse({
      ...resistor,
      pins: resistor.pins.map((pin, index) =>
        index === 0 ? { ...pin, at: { ...pin.at, x: pin.at.x + 5 } } : pin,
      ),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain(
        "10-unit connection grid",
      );
    }
  });

  it("keeps multi-port pins on-grid after every rotation and mirror", () => {
    const placements = [
      { rotation: 0 as const, mirror: "none" as const },
      { rotation: 90 as const, mirror: "none" as const },
      { rotation: 180 as const, mirror: "x" as const },
      { rotation: 270 as const, mirror: "x" as const },
    ];
    for (const symbol of builtInSymbols.filter(
      (candidate) => candidate.pins.length > 2,
    )) {
      for (const placement of placements) {
        for (const pin of symbol.pins) {
          const point = transformPoint(pin.at, { x: 120, y: 230 }, placement);
          expect(Math.abs(point.x % SYMBOL_CONNECTION_GRID)).toBe(0);
          expect(Math.abs(point.y % SYMBOL_CONNECTION_GRID)).toBe(0);
        }
      }
    }
  });

  it("preserves MOS electrical bulk pins in textbook variants", () => {
    const resolver = new InMemorySymbolResolver(builtInSymbols);
    const nmos = resolver.resolve("nmos", "textbook-3terminal");
    const pmos = resolver.resolve("pmos", "textbook-3terminal");
    expect(nmos?.definition.pins.map((pin) => pin.name)).toEqual([
      "D",
      "G",
      "S",
      "B",
    ]);
    expect(nmos?.variant?.hiddenPinNames).toEqual(["B"]);
    expect(nmos?.variant?.hiddenPrimitiveParts).toEqual(["bulk-lead"]);
    expect(nmos?.variant?.additionalPrimitives).toEqual([
      {
        kind: "polygon",
        points: [
          { x: 10, y: 14 },
          { x: 2, y: 10 },
          { x: 4, y: 19 },
        ],
        fill: "foreground",
        part: "source-arrow",
      },
    ]);
    expect(pmos?.variant?.additionalPrimitives).toEqual([
      {
        kind: "polygon",
        points: [
          { x: 2, y: 14 },
          { x: 10, y: 10 },
          { x: 8, y: 19 },
        ],
        fill: "foreground",
        part: "source-arrow",
      },
    ]);
    for (const symbolId of ["nmos3", "pmos3"]) {
      const symbol = builtInSymbols.find(
        (candidate) => candidate.id === symbolId,
      );
      expect(
        symbol?.primitives.filter((primitive) => primitive.kind === "polygon"),
      ).toHaveLength(1);
    }
  });

  it("preserves reviewed NMOS and PMOS default bulk-arrow direction", () => {
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
