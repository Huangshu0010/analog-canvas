import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { transformPoint } from "@icm/model";
import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import { requireRazaviCatalogSymbol } from "./razavi-catalog.js";
import { InMemorySymbolResolver } from "./resolver.js";
import { SYMBOL_CONNECTION_GRID, SymbolDefinitionSchema } from "./schema.js";

describe("initial built-in Symbol Library", () => {
  it("contains the reviewed Phase 5 production families", () => {
    expect(builtInSymbols.map((symbol) => symbol.id)).toEqual([
      "decorative-note-box",
      "resistor",
      "poly-resistor",
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
      "port-filled",
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

  it("uses the shortened vertical stem for the VDD power symbol", () => {
    const vdd = builtInSymbols.find((symbol) => symbol.id === "vdd");
    expect(vdd?.viewBox).toEqual({ x: -12, y: -2, width: 24, height: 26 });
    expect(vdd?.pins).toMatchObject([
      { name: "P", at: { x: 0, y: 20 }, direction: "south" },
    ]);
    expect(vdd?.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "line",
          from: { x: 0, y: 20 },
          to: { x: 0, y: 2.5 },
        }),
        expect.objectContaining({
          kind: "polygon",
          points: [
            { x: -10, y: -0.88 },
            { x: 10, y: -0.88 },
            { x: 10, y: 2.36 },
            { x: -10, y: 2.36 },
          ],
          fill: "foreground",
          stroke: "none",
        }),
      ]),
    );
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
    expect(nmos?.variant?.hiddenPrimitiveParts).toEqual([
      "bulk-lead",
      "source-arrow-host",
    ]);
    for (const resolved of [nmos, pmos]) {
      expect(resolved?.variant?.additionalPrimitives).toEqual([
        expect.objectContaining({ kind: "polyline", part: "source-arrow" }),
        expect.objectContaining({
          kind: "polygon",
          fill: "foreground",
          stroke: "none",
          part: "source-arrow",
        }),
      ]);
    }
    for (const symbolId of ["nmos3", "pmos3"]) {
      const symbol = builtInSymbols.find(
        (candidate) => candidate.id === symbolId,
      );
      expect(
        symbol?.primitives.filter(
          (primitive) =>
            primitive.kind === "polygon" && primitive.part === "source-arrow",
        ),
      ).toHaveLength(1);
      expect(symbol).toBe(requireRazaviCatalogSymbol(symbolId));
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
      (primitive) =>
        primitive.kind === "polygon" && primitive.part === "bulk-lead",
    );
    const pmosArrow = pmos.primitives.find(
      (primitive) =>
        primitive.kind === "polygon" && primitive.part === "bulk-lead",
    );
    expect(nmosArrow?.kind === "polygon" && nmosArrow.stroke).toBe("none");
    expect(pmosArrow?.kind === "polygon" && pmosArrow.stroke).toBe("none");
    if (nmosArrow?.kind !== "polygon" || pmosArrow?.kind !== "polygon") {
      throw new Error("MOS assets must contain decoded Visio arrowheads");
    }
    expect(nmosArrow.points[0]!.x).toBeLessThan(nmosArrow.points[1]!.x);
    expect(pmosArrow.points[0]!.x).toBeGreaterThan(pmosArrow.points[1]!.x);
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
