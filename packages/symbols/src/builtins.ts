import type { SymbolDefinition, SymbolPin, SymbolPrimitive } from "./schema.js";
import { requireRazaviCatalogSymbol } from "./razavi-catalog.js";

function pin(
  name: string,
  role: string,
  x: number,
  y: number,
  direction: SymbolPin["direction"],
): SymbolPin {
  return {
    name,
    role,
    at: { x, y },
    direction,
    presentation: { visibility: "visible", leadLength: 10 },
  };
}

function migratedThreeTerminalMosArrow(id: "nmos3" | "pmos3"): SymbolPrimitive {
  return {
    kind: "polygon",
    points:
      id === "nmos3"
        ? [
            { x: 10, y: 14 },
            { x: 2, y: 10 },
            { x: 4, y: 19 },
          ]
        : [
            { x: 2, y: -14 },
            { x: 10, y: -10 },
            { x: 8, y: -19 },
          ],
    fill: "foreground",
    part: "source-arrow",
  };
}

function normalizedThreeTerminalVariantArrow(
  id: "nmos" | "pmos",
): SymbolPrimitive {
  const migrated = migratedThreeTerminalMosArrow(
    id === "nmos" ? "nmos3" : "pmos3",
  );
  if (id === "nmos" || migrated.kind !== "polygon") return migrated;
  return {
    ...migrated,
    // The reviewed four-pin PMOS keeps the canonical D-top/S-bottom pin
    // orientation. Reflect only the migrated PMOS artwork so the existing
    // placement transform puts its source arrow on the rendered top branch.
    points: migrated.points.map((point) => ({ x: point.x, y: -point.y })),
  };
}

function mosSymbol(id: "nmos" | "pmos", name: string): SymbolDefinition {
  const thin = {
    strokeWidth: 1.2,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  };
  const thick = { ...thin, strokeWidth: 2.16 };
  const arrow =
    id === "nmos"
      ? [
          { x: -2, y: 0 },
          { x: 7, y: -5 },
          { x: 7, y: 5 },
        ]
      : [
          { x: 16, y: 0 },
          { x: 7, y: -5 },
          { x: 7, y: 5 },
        ];
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -30, y: -30, width: 60, height: 60 },
    pins: [
      pin("D", "drain", 20, -30, "north"),
      pin("G", "gate", -30, 0, "west"),
      pin("S", "source", 20, 30, "south"),
      pin("B", "bulk", 30, 0, "east"),
    ],
    primitives: [
      {
        kind: "line",
        from: { x: -30, y: 0 },
        to: { x: -17, y: 0 },
        style: thin,
      },
      {
        kind: "line",
        from: { x: -17, y: -14 },
        to: { x: -17, y: 14 },
        style: thick,
      },
      {
        kind: "line",
        from: { x: -10, y: -20 },
        to: { x: -10, y: 20 },
        style: thick,
      },
      {
        kind: "line",
        from: { x: -10, y: -14 },
        to: { x: 20, y: -14 },
        style: thin,
      },
      {
        kind: "line",
        from: { x: 20, y: -30 },
        to: { x: 20, y: -14 },
        style: thin,
      },
      {
        kind: "line",
        from: { x: -10, y: 14 },
        to: { x: 20, y: 14 },
        style: thin,
      },
      {
        kind: "line",
        from: { x: 20, y: 14 },
        to: { x: 20, y: 30 },
        style: thin,
      },
      {
        kind: "line",
        from: { x: -10, y: 0 },
        to: { x: 30, y: 0 },
        part: "bulk-lead",
        style: thin,
      },
      {
        kind: "polygon",
        points: arrow,
        fill: "foreground",
        part: "bulk-lead",
      },
    ],
    variants: [
      {
        id: "textbook-3terminal",
        hiddenPinNames: ["B"],
        hiddenPrimitiveParts: ["bulk-lead"],
        additionalPrimitives: [normalizedThreeTerminalVariantArrow(id)],
      },
    ],
    aliases: [id === "nmos" ? "mos-n" : "mos-p"],
  };
}

function threeTerminalMosSymbol(
  id: "nmos3" | "pmos3",
  name: string,
): SymbolDefinition {
  const isNmos = id === "nmos3";
  const base = mosSymbol(isNmos ? "nmos" : "pmos", name);
  const body = base.primitives.filter(
    (primitive) => primitive.part !== "bulk-lead",
  );
  return {
    ...base,
    id,
    name,
    pins: base.pins.filter((candidate) => candidate.name !== "B"),
    primitives: [...body, migratedThreeTerminalMosArrow(id)],
    variants: [],
    aliases: [isNmos ? "mos-n-3" : "mos-p-3"],
  };
}

function powerPortSymbol(id: "vdd" | "vss", name: string): SymbolDefinition {
  const upward = id === "vdd";
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -12, y: -24, width: 24, height: 48 },
    pins: [pin("P", "power", 0, upward ? 20 : -20, upward ? "south" : "north")],
    primitives: upward
      ? [
          {
            kind: "line",
            from: { x: 0, y: 20 },
            to: { x: 0, y: -12 },
            style: { strokeWidth: 1.2, lineCap: "round" },
          },
          {
            kind: "line",
            from: { x: -10, y: -12 },
            to: { x: 10, y: -12 },
            style: { strokeWidth: 2.16, lineCap: "round" },
          },
        ]
      : [
          {
            kind: "line",
            from: { x: 0, y: -20 },
            to: { x: 0, y: 6 },
          },
          {
            kind: "polyline",
            points: [
              { x: -9, y: 6 },
              { x: 0, y: 16 },
              { x: 9, y: 6 },
            ],
          },
        ],
    variants: [],
    aliases: upward ? ["power", "supply"] : ["negative-supply"],
  };
}

const genericBlock: SymbolDefinition = {
  schemaVersion: 1,
  id: "generic-block",
  name: "Generic Block",
  viewBox: { x: -30, y: -20, width: 60, height: 40 },
  pins: [
    pin("1", "unknown", -30, 0, "west"),
    pin("2", "unknown", 30, 0, "east"),
  ],
  primitives: [
    {
      kind: "polyline",
      points: [
        { x: -20, y: -18 },
        { x: 20, y: -18 },
        { x: 20, y: 18 },
        { x: -20, y: 18 },
        { x: -20, y: -18 },
      ],
    },
    { kind: "line", from: { x: -30, y: 0 }, to: { x: -20, y: 0 } },
    { kind: "line", from: { x: 20, y: 0 }, to: { x: 30, y: 0 } },
  ],
  variants: [],
  aliases: [],
};

const catalogDiode = requireRazaviCatalogSymbol("diode");

function verticalDiodeSymbol(
  id: "zener" | "schottky",
  name: string,
): SymbolDefinition {
  const cathode =
    id === "zener"
      ? [
          {
            kind: "line" as const,
            from: { x: -12, y: 10 },
            to: { x: 8, y: 10 },
          },
          { kind: "line" as const, from: { x: 8, y: 10 }, to: { x: 13, y: 6 } },
        ]
      : [
          {
            kind: "line" as const,
            from: { x: -12, y: 10 },
            to: { x: 12, y: 10 },
          },
          {
            kind: "line" as const,
            from: { x: -12, y: 10 },
            to: { x: -12, y: 5 },
          },
          {
            kind: "line" as const,
            from: { x: 12, y: 10 },
            to: { x: 12, y: 15 },
          },
        ];
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -18, y: -30, width: 36, height: 60 },
    pins: [
      pin("K", "cathode", 0, -30, "north"),
      pin("A", "anode", 0, 30, "south"),
    ],
    primitives: [
      { kind: "line", from: { x: 0, y: -30 }, to: { x: 0, y: -12 } },
      {
        kind: "polygon",
        points: [
          { x: -12, y: -12 },
          { x: 12, y: -12 },
          { x: 0, y: 9 },
        ],
        fill: "none",
      },
      ...cathode,
      { kind: "line", from: { x: 0, y: 10 }, to: { x: 0, y: 30 } },
    ],
    variants: [],
    aliases: [],
  };
}

const led: SymbolDefinition = {
  ...catalogDiode,
  id: "led",
  name: "LED",
  primitives: [
    ...catalogDiode.primitives,
    { kind: "line", from: { x: 0, y: -10 }, to: { x: 10, y: -20 } },
    {
      kind: "polygon",
      points: [
        { x: 10, y: -20 },
        { x: 7, y: -14 },
        { x: 4, y: -17 },
      ],
      fill: "foreground",
    },
    { kind: "line", from: { x: 8, y: -4 }, to: { x: 18, y: -14 } },
    {
      kind: "polygon",
      points: [
        { x: 18, y: -14 },
        { x: 15, y: -8 },
        { x: 12, y: -11 },
      ],
      fill: "foreground",
    },
  ],
  aliases: ["light-emitting-diode"],
};

function waveformSource(
  id: "ac-voltage-source" | "pulse-voltage-source",
  name: string,
): SymbolDefinition {
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -18, y: -30, width: 36, height: 60 },
    pins: [
      pin("+", "positive", 0, -30, "north"),
      pin("-", "negative", 0, 30, "south"),
    ],
    primitives: [
      { kind: "line", from: { x: 0, y: -30 }, to: { x: 0, y: -15 } },
      { kind: "circle", center: { x: 0, y: 0 }, radius: 15 },
      { kind: "line", from: { x: 0, y: 15 }, to: { x: 0, y: 30 } },
      id === "ac-voltage-source"
        ? {
            kind: "path",
            data: "M -10 0 C -7 -9 -2 -9 0 0 C 2 9 7 9 10 0",
          }
        : {
            kind: "polyline",
            points: [
              { x: -10, y: 7 },
              { x: -6, y: 7 },
              { x: -6, y: -7 },
              { x: 3, y: -7 },
              { x: 3, y: 7 },
              { x: 10, y: 7 },
            ],
          },
    ],
    variants: [],
    aliases: [id === "ac-voltage-source" ? "v-ac" : "v-pulse"],
  };
}

const opamp: SymbolDefinition = {
  schemaVersion: 1,
  id: "opamp",
  name: "Operational Amplifier",
  viewBox: { x: -30, y: -30, width: 70, height: 60 },
  pins: [
    pin("+", "non-inverting", -30, -10, "west"),
    pin("-", "inverting", -30, 10, "west"),
    pin("OUT", "output", 40, 0, "east"),
  ],
  primitives: [
    { kind: "line", from: { x: -30, y: -10 }, to: { x: -20, y: -10 } },
    { kind: "line", from: { x: -30, y: 10 }, to: { x: -20, y: 10 } },
    {
      kind: "polygon",
      points: [
        { x: -20, y: -28 },
        { x: -20, y: 28 },
        { x: 30, y: 0 },
      ],
      fill: "none",
      style: { strokeWidth: 1.6, lineCap: "round", lineJoin: "round" },
    },
    { kind: "line", from: { x: 30, y: 0 }, to: { x: 40, y: 0 } },
    { kind: "line", from: { x: -16, y: -10 }, to: { x: -10, y: -10 } },
    { kind: "line", from: { x: -13, y: -13 }, to: { x: -13, y: -7 } },
    { kind: "line", from: { x: -16, y: 10 }, to: { x: -10, y: 10 } },
  ],
  variants: [],
  aliases: ["op-amp"],
};

function switchSymbol(
  id: "switch-open" | "switch-closed",
  name: string,
): SymbolDefinition {
  const closed = id === "switch-closed";
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -30, y: -12, width: 60, height: 24 },
    pins: [
      pin("1", "passive", -30, 0, "west"),
      pin("2", "passive", 30, 0, "east"),
    ],
    primitives: [
      { kind: "line", from: { x: -30, y: 0 }, to: { x: -18, y: 0 } },
      { kind: "circle", center: { x: -14, y: 0 }, radius: 3 },
      { kind: "circle", center: { x: 14, y: 0 }, radius: 3 },
      {
        kind: "line",
        from: { x: -11, y: closed ? 0 : -1 },
        to: { x: 11, y: closed ? 0 : -10 },
      },
      { kind: "line", from: { x: 18, y: 0 }, to: { x: 30, y: 0 } },
    ],
    variants: [],
    aliases: [closed ? "switch-on" : "switch-off"],
  };
}

const crystal: SymbolDefinition = {
  schemaVersion: 1,
  id: "crystal",
  name: "Crystal",
  viewBox: { x: -15, y: -30, width: 30, height: 60 },
  pins: [
    pin("1", "passive", 0, -30, "north"),
    pin("2", "passive", 0, 30, "south"),
  ],
  primitives: [
    { kind: "line", from: { x: 0, y: -30 }, to: { x: 0, y: -14 } },
    { kind: "line", from: { x: -10, y: -14 }, to: { x: 10, y: -14 } },
    {
      kind: "polyline",
      points: [
        { x: -12, y: -8 },
        { x: 12, y: -8 },
        { x: 12, y: 8 },
        { x: -12, y: 8 },
        { x: -12, y: -8 },
      ],
      style: { strokeWidth: 2 },
    },
    { kind: "line", from: { x: -10, y: 14 }, to: { x: 10, y: 14 } },
    { kind: "line", from: { x: 0, y: 14 }, to: { x: 0, y: 30 } },
  ],
  variants: [],
  aliases: ["xtal"],
};

const transformer: SymbolDefinition = {
  schemaVersion: 1,
  id: "transformer",
  name: "Transformer",
  viewBox: { x: -35, y: -40, width: 70, height: 80 },
  pins: [
    pin("P1", "primary", -20, -40, "north"),
    pin("P2", "primary", -20, 40, "south"),
    pin("S1", "secondary", 20, -40, "north"),
    pin("S2", "secondary", 20, 40, "south"),
  ],
  primitives: [
    { kind: "line", from: { x: -20, y: -40 }, to: { x: -20, y: -24 } },
    {
      kind: "path",
      data: "M -20 -24 C -8 -24 -8 -12 -20 -12 C -8 -12 -8 0 -20 0 C -8 0 -8 12 -20 12 C -8 12 -8 24 -20 24",
    },
    { kind: "line", from: { x: -20, y: 24 }, to: { x: -20, y: 40 } },
    { kind: "line", from: { x: 20, y: -40 }, to: { x: 20, y: -24 } },
    {
      kind: "path",
      data: "M 20 -24 C 8 -24 8 -12 20 -12 C 8 -12 8 0 20 0 C 8 0 8 12 20 12 C 8 12 8 24 20 24",
    },
    { kind: "line", from: { x: 20, y: 24 }, to: { x: 20, y: 40 } },
    { kind: "line", from: { x: -3, y: -25 }, to: { x: -3, y: 25 } },
    { kind: "line", from: { x: 3, y: -25 }, to: { x: 3, y: 25 } },
  ],
  variants: [],
  aliases: [],
};

const catalogCapacitor = requireRazaviCatalogSymbol("capacitor");
const catalogCurrentSource = requireRazaviCatalogSymbol("current-source");
const catalogGround = requireRazaviCatalogSymbol("ground");
const catalogInductor = requireRazaviCatalogSymbol("inductor");
const catalogResistor = requireRazaviCatalogSymbol("resistor");
const catalogNmos = requireRazaviCatalogSymbol("nmos");
const catalogNpn = requireRazaviCatalogSymbol("npn");
const catalogPmos = requireRazaviCatalogSymbol("pmos");
const catalogPmos3 = requireRazaviCatalogSymbol("pmos3");
const catalogPnp = requireRazaviCatalogSymbol("pnp");
const catalogPort = requireRazaviCatalogSymbol("port");
const catalogVoltageSource = requireRazaviCatalogSymbol("voltage-source");

export const builtInSymbols: readonly SymbolDefinition[] = [
  catalogResistor,
  catalogCapacitor,
  catalogInductor,
  catalogNmos,
  catalogPmos,
  threeTerminalMosSymbol("nmos3", "NMOS (3-terminal)"),
  catalogPmos3,
  catalogGround,
  powerPortSymbol("vdd", "VDD Power Port"),
  powerPortSymbol("vss", "VSS Power Port"),
  catalogPort,
  catalogVoltageSource,
  catalogCurrentSource,
  waveformSource("ac-voltage-source", "AC Voltage Source"),
  waveformSource("pulse-voltage-source", "Pulse Voltage Source"),
  catalogDiode,
  verticalDiodeSymbol("zener", "Zener Diode"),
  verticalDiodeSymbol("schottky", "Schottky Diode"),
  led,
  catalogNpn,
  catalogPnp,
  opamp,
  switchSymbol("switch-open", "Open Switch"),
  switchSymbol("switch-closed", "Closed Switch"),
  crystal,
  transformer,
  genericBlock,
];
