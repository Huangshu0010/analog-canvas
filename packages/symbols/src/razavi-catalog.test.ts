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
const mosGeometry = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "fixtures/visual-reference/razavi-reference-v1/mos-geometry.json",
    ),
    "utf8",
  ),
) as {
  symbols: Record<
    "nmos" | "pmos",
    {
      pixelsPerLogical: number;
      originPx: { x: number; y: number };
      gateBarsPx: Array<{
        left: number;
        top: number;
        right: number;
        bottom: number;
      }>;
      channelsPx: Record<
        "upper" | "lower",
        {
          from: { x: number; y: number };
          to: { x: number; y: number };
        }
      >;
      sourceArrowPx: {
        support: {
          from: { x: number; y: number };
          to: { x: number; y: number };
        };
        tip: { x: number; y: number };
        baseTop: { x: number; y: number };
        baseBottom: { x: number; y: number };
      };
    }
  >;
};
const normalize = (value: string) =>
  `${value.replaceAll("\r\n", "\n").trimEnd()}\n`;
const logicalPoint = (
  measurement: (typeof mosGeometry.symbols)["nmos"],
  point: { x: number; y: number },
) => ({
  x:
    Math.round(
      ((point.x - measurement.originPx.x) / measurement.pixelsPerLogical) *
        1_000_000,
    ) / 1_000_000,
  y:
    Math.round(
      ((point.y - measurement.originPx.y) / measurement.pixelsPerLogical) *
        1_000_000,
    ) / 1_000_000,
});

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
        expect(primitive.style.strokeRole).toMatch(
          /^(normal|emphasis|ground)$/u,
        );
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
          kind: "razavi-raster-reference",
          converterPath: "scripts/generate-razavi-mos-assets.mjs",
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
      "port",
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

  it("uses the sole Razavi raster for peripheral presentation assets", () => {
    for (const symbolId of ["ground", "voltage-source", "current-source"]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        generation: {
          kind: "razavi-raster-reference",
          referenceManifestPath:
            "fixtures/visual-reference/razavi-reference-v1/manifest.json",
          converterPath: "scripts/generate-razavi-peripheral-assets.mjs",
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
      expect.arrayContaining([
        expect.objectContaining({
          kind: "circle",
          fill: "foreground",
          stroke: "none",
        }),
      ]),
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

  it("uses raster-authored Razavi MOS bodies without moving electrical pin anchors", () => {
    const nmos = requireRazaviCatalogSymbol("nmos");
    const measurement = mosGeometry.symbols.nmos;
    const outerGate = measurement.gateBarsPx[0]!;
    const upperChannel = measurement.channelsPx.upper;
    expect(nmos.pins).toMatchObject([
      { name: "D", at: { x: 10, y: -20 } },
      { name: "G", at: { x: -20, y: 0 } },
      { name: "S", at: { x: 10, y: 20 } },
      { name: "B", at: { x: 20, y: 0 } },
    ]);
    expect(nmos.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "polygon",
          points: [
            logicalPoint(measurement, {
              x: outerGate.left,
              y: outerGate.top,
            }),
            logicalPoint(measurement, {
              x: outerGate.left,
              y: outerGate.bottom,
            }),
            logicalPoint(measurement, {
              x: outerGate.right,
              y: outerGate.bottom,
            }),
            logicalPoint(measurement, {
              x: outerGate.right,
              y: outerGate.top,
            }),
          ],
          fill: "foreground",
          stroke: "none",
          part: "gate-bar",
        }),
        expect.objectContaining({
          kind: "line",
          from: logicalPoint(measurement, upperChannel.from),
          to: logicalPoint(measurement, upperChannel.to),
          style: {
            strokeRole: "normal",
            lineCap: "butt",
            lineJoin: "miter",
          },
        }),
      ]),
    );
  });

  it("keeps the Razavi ground mark compact and lead-aligned", () => {
    const ground = requireRazaviCatalogSymbol("ground");
    expect(ground.pins).toMatchObject([
      { name: "0", at: { x: 0, y: -10 }, direction: "north" },
    ]);
    expect(ground.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "line",
          from: { x: -6.395349, y: 0 },
          to: { x: 6.395349, y: 0 },
        }),
        expect.objectContaining({
          kind: "line",
          from: { x: -4.069767, y: 5.813953 },
          to: { x: 4.069767, y: 5.813953 },
        }),
        expect.objectContaining({
          kind: "line",
          from: { x: -2.325581, y: 11.046512 },
          to: { x: 2.325581, y: 11.046512 },
        }),
      ]),
    );
  });

  it("uses calibrated MOS and source arrowheads with external voltage polarity marks", () => {
    const voltage = requireRazaviCatalogSymbol("voltage-source");
    expect(voltage.viewBox).toEqual({ x: -24, y: -24, width: 39, height: 48 });
    expect(voltage.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "circle",
          radius: 10.755814,
          style: expect.objectContaining({ strokeRole: "normal" }),
        }),
        expect.objectContaining({
          kind: "line",
          from: { x: -20.058139, y: -14.534884 },
          to: { x: -11.918605, y: -14.534884 },
        }),
        expect.objectContaining({
          kind: "line",
          from: { x: -15.988372, y: -18.604651 },
          to: { x: -15.988372, y: -10.465117 },
        }),
        expect.objectContaining({
          kind: "line",
          from: { x: -20.058139, y: 13.372093 },
          to: { x: -11.918605, y: 13.372093 },
        }),
      ]),
    );

    for (const symbolId of ["nmos", "pmos"] as const) {
      const mos = requireRazaviCatalogSymbol(symbolId);
      const measurement = mosGeometry.symbols[symbolId];
      const arrow = measurement.sourceArrowPx;
      const variant = mos.variants.find(
        (candidate) => candidate.id === "textbook-3terminal",
      );
      expect(variant?.hiddenPrimitiveParts).toEqual([
        "bulk-lead",
        "source-arrow-host",
      ]);
      expect(variant?.additionalPrimitives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "line",
            from: logicalPoint(measurement, arrow.support.from),
            to: logicalPoint(measurement, arrow.support.to),
            style: expect.objectContaining({ lineCap: "butt" }),
          }),
          expect.objectContaining({
            kind: "polygon",
            points: [
              logicalPoint(measurement, arrow.tip),
              logicalPoint(measurement, arrow.baseTop),
              logicalPoint(measurement, arrow.baseBottom),
            ],
            part: "source-arrow",
            fill: "foreground",
          }),
        ]),
      );
    }

    const current = requireRazaviCatalogSymbol("current-source");
    expect(current.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "line",
          from: { x: 0, y: -6.976744 },
          to: { x: 0, y: -2.325581 },
        }),
        expect.objectContaining({
          kind: "polygon",
          points: [
            { x: 0, y: 6.976744 },
            { x: -4.651163, y: -2.325581 },
            { x: 4.651163, y: -2.325581 },
          ],
          fill: "foreground",
          stroke: "none",
        }),
      ]),
    );
  });

  it("derives each textbook MOS arrow from its screenshot pixel map", () => {
    for (const symbolId of ["nmos", "pmos"] as const) {
      const variant = requireRazaviCatalogSymbol(symbolId).variants.find(
        (candidate) => candidate.id === "textbook-3terminal",
      );
      const measurement = mosGeometry.symbols[symbolId];
      const arrow = measurement.sourceArrowPx;
      const support = variant?.additionalPrimitives?.find(
        (primitive) =>
          primitive.kind === "line" && primitive.part === "source-arrow",
      );
      const head = variant?.additionalPrimitives?.find(
        (primitive) =>
          primitive.kind === "polygon" && primitive.part === "source-arrow",
      );
      expect(support).toMatchObject({ kind: "line" });
      expect(head).toMatchObject({ kind: "polygon" });
      if (support?.kind !== "line" || head?.kind !== "polygon") {
        throw new Error(`${symbolId} has no textbook source arrow`);
      }
      expect(support).toMatchObject({
        from: logicalPoint(measurement, arrow.support.from),
        to: logicalPoint(measurement, arrow.support.to),
      });
      expect(head).toMatchObject({
        points: [
          logicalPoint(measurement, arrow.tip),
          logicalPoint(measurement, arrow.baseTop),
          logicalPoint(measurement, arrow.baseBottom),
        ],
      });
    }
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
