import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { builtInSymbols } from "./builtins.js";
import {
  getRazaviCatalogEntry,
  isRazaviReferencePaletteEntry,
  requireRazaviCatalogSymbol,
  razaviCatalogSymbols,
  razaviReferencePaletteSymbols,
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

const canonicalMosBodyPrimitives = (symbolId: "nmos" | "pmos") =>
  requireRazaviCatalogSymbol(symbolId)
    .primitives.filter((primitive) => primitive.part !== "bulk-lead")
    .map(({ part: _part, ...primitive }) => primitive)
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );

describe("Razavi symbol catalog", () => {
  it("publishes the versioned catalog identity and visual authority", () => {
    expect(razaviSymbolCatalogIdentity).toMatchObject({
      schemaVersion: 2,
      id: "razavi-symbols",
      version: 1,
    });
    expect(
      razaviSymbolCatalogEntries.map((entry) => [
        entry.symbolId,
        entry.reviewStatus,
        entry.visualAuthority.kind,
      ]),
    ).toEqual([
      ["capacitor", "reviewed", "razavi-reference-v1"],
      ["current-source", "reviewed", "razavi-reference-v1"],
      ["diode", "reviewed", "legacy-compatibility"],
      ["ground", "reviewed", "razavi-reference-v1"],
      ["inductor", "reviewed", "legacy-compatibility"],
      ["nmos", "reviewed", "razavi-reference-v1"],
      ["nmos3", "provisional", "razavi-reference-v1"],
      ["npn", "reviewed", "legacy-compatibility"],
      ["pmos", "reviewed", "razavi-reference-v1"],
      ["pmos3", "provisional", "razavi-reference-v1"],
      ["pnp", "reviewed", "legacy-compatibility"],
      ["port", "reviewed", "razavi-reference-v1"],
      ["port-filled", "reviewed", "razavi-reference-v1"],
      ["resistor", "reviewed", "razavi-reference-v1"],
      ["voltage-source", "reviewed", "razavi-reference-v1"],
      ["vdd", "reviewed", "razavi-reference-v1"],
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
    expect(razaviCatalogSymbols).toHaveLength(16);
    for (const catalogSymbol of razaviCatalogSymbols) {
      expect(
        builtInSymbols.find((symbol) => symbol.id === catalogSymbol.id),
      ).toBe(catalogSymbol);
      expect(requireRazaviCatalogSymbol(catalogSymbol.id)).toBe(catalogSymbol);
      expect(getRazaviCatalogEntry(catalogSymbol.id)).toBeDefined();
    }
  });

  it("lists only reviewed Reference-calibrated assets in the Razavi palette", () => {
    expect(razaviReferencePaletteSymbols.map((symbol) => symbol.id)).toEqual([
      "capacitor",
      "current-source",
      "ground",
      "nmos",
      "pmos",
      "port",
      "port-filled",
      "resistor",
      "voltage-source",
      "vdd",
    ]);
    for (const entry of razaviSymbolCatalogEntries) {
      expect(isRazaviReferencePaletteEntry(entry)).toBe(
        razaviReferencePaletteSymbols.some(
          (symbol) => symbol.id === entry.symbolId,
        ),
      );
    }
  });

  it("keeps provisional three-terminal MOS assets out of automatic mappings", () => {
    for (const symbolId of ["nmos3", "pmos3"]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        reviewStatus: "provisional",
        automaticMappings: [],
        palette: true,
        visualAuthority: {
          kind: "razavi-reference-v1",
        },
      });
    }
  });

  it("retains only unmigrated assets as legacy compatibility symbols", () => {
    for (const symbolId of ["inductor", "diode", "npn", "pnp"]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        reviewStatus: "reviewed",
        visualAuthority: {
          kind: "legacy-compatibility",
        },
      });
    }
  });

  it("records Reference calibration for the complete active palette", () => {
    for (const symbolId of [
      "resistor",
      "capacitor",
      "port",
      "port-filled",
      "ground",
      "voltage-source",
      "current-source",
    ]) {
      expect(getRazaviCatalogEntry(symbolId)).toMatchObject({
        visualAuthority: {
          kind: "razavi-reference-v1",
          referenceManifestPath:
            "fixtures/visual-reference/razavi-reference-v1/manifest.json",
        },
      });
    }
  });

  it("keeps the calibrated active geometry and grid-pin orientation", () => {
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
          fill: "none",
          stroke: "foreground",
        }),
      ]),
    );
    const hollowPort = requireRazaviCatalogSymbol("port");
    const filledPort = requireRazaviCatalogSymbol("port-filled");
    expect(filledPort.pins).toEqual(hollowPort.pins);
    expect(filledPort.viewBox).toEqual(hollowPort.viewBox);
    expect(filledPort.primitives[1]).toEqual(hollowPort.primitives[1]);
    expect(filledPort.primitives[0]).toMatchObject({
      kind: "circle",
      center: { x: -7.086614, y: 0 },
      radius: 2.47907,
      fill: "foreground",
      stroke: "foreground",
    });
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
          kind: "polyline",
          points: [
            logicalPoint(measurement, {
              ...upperChannel.from,
              x: upperChannel.from.x - 1,
            }),
            logicalPoint(measurement, measurement.leadsPx.D.from),
            logicalPoint(measurement, measurement.leadsPx.D.to),
          ],
          style: {
            strokeRole: "normal",
            lineCap: "butt",
            lineJoin: "miter",
          },
        }),
      ]),
    );
  });

  it("uses NMOS canonical geometry for every non-arrow PMOS body primitive", () => {
    expect(canonicalMosBodyPrimitives("pmos")).toEqual(
      canonicalMosBodyPrimitives("nmos"),
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

  it("uses one screenshot-authored sharp Razavi resistor path through both leads", () => {
    const resistor = requireRazaviCatalogSymbol("resistor");
    expect(resistor.primitives[0]).toMatchObject({
      kind: "path",
      data: "M 0 -20 L 0 -8.72093 L 8.139535 -6.395349 L -6.976744 -4.069767 L 8.139535 -1.162791 L -7.55814 1.744186 L 8.139535 4.651163 L -6.976744 7.55814 L 0 8.72093 L 0 20",
      style: {
        strokeRole: "normal",
        lineCap: "butt",
        lineJoin: "miter",
      },
    });
    expect(resistor.primitives).toHaveLength(1);
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
            kind: "polyline",
            points: [
              logicalPoint(measurement, arrow.support.from),
              logicalPoint(
                measurement,
                measurement.leadsPx[symbolId === "nmos" ? "S" : "D"].from,
              ),
              logicalPoint(
                measurement,
                measurement.leadsPx[symbolId === "nmos" ? "S" : "D"].to,
              ),
            ],
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
          primitive.kind === "polyline" && primitive.part === "source-arrow",
      );
      const head = variant?.additionalPrimitives?.find(
        (primitive) =>
          primitive.kind === "polygon" && primitive.part === "source-arrow",
      );
      expect(support).toMatchObject({ kind: "polyline" });
      expect(head).toMatchObject({ kind: "polygon" });
      if (support?.kind !== "polyline" || head?.kind !== "polygon") {
        throw new Error(`${symbolId} has no textbook source arrow`);
      }
      expect(support).toMatchObject({
        points: [
          logicalPoint(measurement, arrow.support.from),
          logicalPoint(
            measurement,
            measurement.leadsPx[symbolId === "nmos" ? "S" : "D"].from,
          ),
          logicalPoint(
            measurement,
            measurement.leadsPx[symbolId === "nmos" ? "S" : "D"].to,
          ),
        ],
      });
      const elbow = support.points[1]!;
      const pin = support.points[2]!;
      expect(elbow.x).toBe(pin.x);
      expect(elbow.y).not.toBe(pin.y);
      expect(head).toMatchObject({
        points: [
          logicalPoint(measurement, arrow.tip),
          logicalPoint(measurement, arrow.baseTop),
          logicalPoint(measurement, arrow.baseBottom),
        ],
      });
    }
  });

  it("classifies the junction dot as a semantic primitive, not a component", () => {
    expect(razaviSemanticPrimitives).toEqual([
      expect.objectContaining({
        id: "junction-dot",
        disposition: "semantic-primitive",
        runtimeOwner: "presentation.nodes.junction",
      }),
    ]);
    expect(
      razaviCatalogSymbols.some((symbol) => symbol.id === "junction-dot"),
    ).toBe(false);
  });
});
