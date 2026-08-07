import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import {
  getRazaviCatalogEntry,
  requireRazaviCatalogSymbol,
  razaviCatalogSymbols,
  razaviSemanticPrimitives,
  razaviSymbolCatalogEntries,
  razaviSymbolCatalogIdentity,
} from "./razavi-catalog.js";
import { SymbolDefinitionSchema } from "./schema.js";

const assetRoot = resolve(process.cwd(), "packages/symbols/assets/razavi-v1");
const normalize = (value: string) =>
  `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;

describe("Razavi symbol catalog", () => {
  it("publishes the versioned catalog identity and source provenance", () => {
    expect(razaviSymbolCatalogIdentity).toMatchObject({
      schemaVersion: 1,
      id: "razavi-symbols",
      version: 1,
      decoder: { id: "icm-vss-master-ir", version: "0.1.0" },
    });
    expect(
      razaviSymbolCatalogEntries.map((entry) => [
        entry.symbolId,
        entry.source.masterNameU,
        entry.reviewStatus,
      ]),
    ).toEqual([
      ["capacitor", "C", "reviewed"],
      ["current-source", "DC-I", "reviewed"],
      ["diode", "Diode1", "reviewed"],
      ["ground", "GND", "reviewed"],
      ["inductor", "L", "reviewed"],
      ["nmos", "NMOS4", "reviewed"],
      ["nmos3", "Nmos3.a", "provisional"],
      ["npn", "npn", "reviewed"],
      ["pmos", "PMOS4", "reviewed"],
      ["pmos3", "Pmos3.a", "provisional"],
      ["pnp", "pnp", "reviewed"],
      ["port", "I/O", "reviewed"],
      ["resistor", "R", "reviewed"],
      ["voltage-source", "DC-V", "reviewed"],
    ]);
  });

  it("validates every source asset, pin order, and byte hash", () => {
    for (const entry of razaviSymbolCatalogEntries) {
      const source = readFileSync(resolve(assetRoot, entry.assetPath), "utf8");
      const asset = SymbolDefinitionSchema.parse(JSON.parse(source));
      expect(asset.id).toBe(entry.symbolId);
      expect(asset.pins.map((pin) => pin.name)).toEqual(entry.pinOrder);
      expect(createHash("sha256").update(normalize(source)).digest("hex")).toBe(
        entry.assetHash,
      );
    }
  });

  it("uses semantic roles instead of raw VSS widths in migrated assets", () => {
    for (const symbol of razaviCatalogSymbols) {
      const primitives = [
        ...symbol.primitives,
        ...symbol.variants.flatMap(
          (variant) => variant.additionalPrimitives ?? [],
        ),
      ];
      for (const primitive of primitives) {
        if (!primitive.style) continue;
        expect(primitive.style.strokeWidth).toBeUndefined();
        expect(primitive.style.strokeRole).toMatch(/^(normal|emphasis)$/u);
      }
    }

    const invalid = SymbolDefinitionSchema.safeParse({
      ...requireRazaviCatalogSymbol("nmos"),
      primitives: [
        {
          kind: "line",
          from: { x: 0, y: 0 },
          to: { x: 10, y: 0 },
          style: { strokeRole: "normal", strokeWidth: 1.2 },
        },
      ],
    });
    expect(invalid.success).toBe(false);
  });

  it("uses catalog objects in the built-in compatibility library", () => {
    expect(razaviCatalogSymbols).toHaveLength(14);
    for (const catalogSymbol of razaviCatalogSymbols) {
      expect(
        builtInSymbols.find((symbol) => symbol.id === catalogSymbol.id),
      ).toBe(catalogSymbol);
      expect(requireRazaviCatalogSymbol(catalogSymbol.id)).toBe(catalogSymbol);
      expect(getRazaviCatalogEntry(catalogSymbol.id)).toBeDefined();
    }
  });

  it("keeps provisional three-terminal MOS assets out of automatic mappings", () => {
    for (const symbolId of ["nmos3", "pmos3"]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        reviewStatus: "provisional",
        automaticMappings: [],
        palette: true,
        generation: {
          kind: "vss-master-ir",
          converterPath: "scripts/generate-visio-mos-assets.mjs",
          converterVersion: 1,
        },
      });
    }
  });

  it("records independent Visio evidence for the Batch A non-transistor assets", () => {
    for (const symbolId of [
      "resistor",
      "capacitor",
      "inductor",
      "diode",
      "ground",
      "port",
      "voltage-source",
      "current-source",
    ]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        reviewStatus: "reviewed",
        generation: {
          kind: "vss-master-ir",
          evidencePath:
            "fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json",
          converterPath: "scripts/generate-visio-core-analog-assets.mjs",
          converterVersion: 1,
        },
      });
    }
  });

  it("keeps the source-derived Batch A geometry and grid-pin orientation", () => {
    const runtimeResistor = builtInSymbols.find(
      (symbol) => symbol.id === "resistor",
    );
    expect(runtimeResistor).toBe(requireRazaviCatalogSymbol("resistor"));
    expect(runtimeResistor?.pins).toMatchObject([
      { name: "1", at: { x: 0, y: -20 }, direction: "north" },
      { name: "2", at: { x: 0, y: 20 }, direction: "south" },
    ]);
    expect(requireRazaviCatalogSymbol("resistor").pins).toMatchObject([
      { name: "1", at: { x: 0, y: -20 }, direction: "north" },
      { name: "2", at: { x: 0, y: 20 }, direction: "south" },
    ]);
    expect(requireRazaviCatalogSymbol("diode").pins).toMatchObject([
      { name: "A", direction: "west" },
      { name: "K", direction: "east" },
    ]);
    expect(requireRazaviCatalogSymbol("inductor").primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "path",
          data: expect.stringMatching(/^M /u),
        }),
      ]),
    );
    expect(requireRazaviCatalogSymbol("port").primitives).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "circle" })]),
    );
    expect(requireRazaviCatalogSymbol("current-source").primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "polygon", fill: "foreground" }),
      ]),
    );
    expect(requireRazaviCatalogSymbol("ground").labelVisibility).toBe("hidden");
  });

  it("keeps canonical MOS assets four-terminal and three-terminal mode visual-only", () => {
    for (const symbolId of ["nmos", "pmos"]) {
      const symbol = requireRazaviCatalogSymbol(symbolId);
      expect(symbol.pins.map((pin) => pin.name)).toEqual(["D", "G", "S", "B"]);
      expect(
        symbol.variants.find((variant) => variant.id === "textbook-3terminal"),
      ).toMatchObject({ hiddenPinNames: ["B"] });
    }
    expect(getRazaviCatalogEntry("nmos3")?.reviewStatus).toBe("provisional");
  });

  it("classifies the VSS node as a semantic primitive, not a component", () => {
    expect(razaviSemanticPrimitives).toEqual([
      expect.objectContaining({
        id: "junction-dot",
        disposition: "semantic-primitive",
        source: expect.objectContaining({ masterNameU: "node" }),
        runtimeOwner: "presentation.nodes.junction",
      }),
    ]);
    expect(
      razaviCatalogSymbols.some((symbol) => symbol.id === "junction-dot"),
    ).toBe(false);
  });
});
