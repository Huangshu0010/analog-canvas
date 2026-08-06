import type { SymbolDefinition, SymbolPin, SymbolPrimitive } from "./schema.js";

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

function twoTerminalSymbol(
  id: string,
  name: string,
  primitives: SymbolPrimitive[],
): SymbolDefinition {
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -30, y: -15, width: 60, height: 30 },
    pins: [
      pin("1", "passive", -30, 0, "west"),
      pin("2", "passive", 30, 0, "east"),
    ],
    primitives,
    variants: [],
    aliases: [],
  };
}

const resistor = twoTerminalSymbol("resistor", "Resistor", [
  { kind: "line", from: { x: -30, y: 0 }, to: { x: -20, y: 0 } },
  {
    kind: "polyline",
    points: [
      { x: -20, y: 0 },
      { x: -15, y: -8 },
      { x: -5, y: 8 },
      { x: 5, y: -8 },
      { x: 15, y: 8 },
      { x: 20, y: 0 },
    ],
  },
  { kind: "line", from: { x: 20, y: 0 }, to: { x: 30, y: 0 } },
]);

const capacitor = twoTerminalSymbol("capacitor", "Capacitor", [
  { kind: "line", from: { x: -30, y: 0 }, to: { x: -4, y: 0 } },
  { kind: "line", from: { x: -4, y: -12 }, to: { x: -4, y: 12 } },
  { kind: "line", from: { x: 4, y: -12 }, to: { x: 4, y: 12 } },
  { kind: "line", from: { x: 4, y: 0 }, to: { x: 30, y: 0 } },
]);

const inductor = twoTerminalSymbol("inductor", "Inductor", [
  { kind: "line", from: { x: -30, y: 0 }, to: { x: -20, y: 0 } },
  {
    kind: "path",
    data: "M -20 0 C -20 -12 -10 -12 -10 0 C -10 -12 0 -12 0 0 C 0 -12 10 -12 10 0 C 10 -12 20 -12 20 0",
  },
  { kind: "line", from: { x: 20, y: 0 }, to: { x: 30, y: 0 } },
]);

function mosSymbol(id: "nmos" | "pmos", name: string): SymbolDefinition {
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -30, y: -30, width: 60, height: 60 },
    pins: [
      pin("D", "drain", 15, -30, "north"),
      pin("G", "gate", -30, 0, "west"),
      pin("S", "source", 15, 30, "south"),
      pin("B", "bulk", 30, 0, "east"),
    ],
    primitives: [
      { kind: "line", from: { x: -30, y: 0 }, to: { x: -10, y: 0 } },
      { kind: "line", from: { x: -10, y: -18 }, to: { x: -10, y: 18 } },
      { kind: "line", from: { x: -3, y: -16 }, to: { x: -3, y: 16 } },
      { kind: "line", from: { x: -3, y: -12 }, to: { x: 15, y: -12 } },
      { kind: "line", from: { x: 15, y: -30 }, to: { x: 15, y: -12 } },
      { kind: "line", from: { x: -3, y: 12 }, to: { x: 15, y: 12 } },
      { kind: "line", from: { x: 15, y: 12 }, to: { x: 15, y: 30 } },
      {
        kind: "line",
        from: { x: 0, y: 0 },
        to: { x: 30, y: 0 },
        part: "bulk-lead",
      },
      ...(id === "pmos"
        ? [{ kind: "circle" as const, center: { x: -6, y: 0 }, radius: 3 }]
        : []),
    ],
    variants: [
      {
        id: "textbook-3terminal",
        hiddenPinNames: ["B"],
        hiddenPrimitiveParts: ["bulk-lead"],
      },
    ],
    aliases: [id === "nmos" ? "mos-n" : "mos-p"],
  };
}

const ground: SymbolDefinition = {
  schemaVersion: 1,
  id: "ground",
  name: "Ground",
  viewBox: { x: -15, y: -5, width: 30, height: 35 },
  pins: [pin("0", "ground", 0, -5, "north")],
  primitives: [
    { kind: "line", from: { x: 0, y: -5 }, to: { x: 0, y: 10 } },
    { kind: "line", from: { x: -12, y: 10 }, to: { x: 12, y: 10 } },
    { kind: "line", from: { x: -8, y: 16 }, to: { x: 8, y: 16 } },
    { kind: "line", from: { x: -4, y: 22 }, to: { x: 4, y: 22 } },
  ],
  variants: [],
  aliases: ["gnd"],
};

const port: SymbolDefinition = {
  schemaVersion: 1,
  id: "port",
  name: "Port",
  viewBox: { x: -20, y: -10, width: 40, height: 20 },
  pins: [pin("P", "port", 20, 0, "east")],
  primitives: [
    {
      kind: "polyline",
      points: [
        { x: -20, y: -8 },
        { x: 8, y: -8 },
        { x: 18, y: 0 },
        { x: 8, y: 8 },
        { x: -20, y: 8 },
        { x: -20, y: -8 },
      ],
    },
    { kind: "line", from: { x: 18, y: 0 }, to: { x: 20, y: 0 } },
  ],
  variants: [],
  aliases: [],
};

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

function sourceSymbol(
  id: "voltage-source" | "current-source",
  name: string,
): SymbolDefinition {
  const primitives: SymbolPrimitive[] = [
    { kind: "line", from: { x: 0, y: -30 }, to: { x: 0, y: -15 } },
    { kind: "circle", center: { x: 0, y: 0 }, radius: 15 },
    { kind: "line", from: { x: 0, y: 15 }, to: { x: 0, y: 30 } },
  ];
  if (id === "voltage-source") {
    primitives.push(
      { kind: "line", from: { x: -5, y: -6 }, to: { x: 5, y: -6 } },
      { kind: "line", from: { x: 0, y: -11 }, to: { x: 0, y: -1 } },
      { kind: "line", from: { x: -5, y: 7 }, to: { x: 5, y: 7 } },
    );
  } else {
    primitives.push(
      { kind: "line", from: { x: 0, y: 9 }, to: { x: 0, y: -7 } },
      {
        kind: "polygon",
        points: [
          { x: 0, y: -10 },
          { x: -4, y: -3 },
          { x: 4, y: -3 },
        ],
        fill: "foreground",
      },
    );
  }
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -18, y: -30, width: 36, height: 60 },
    pins: [
      pin("+", "positive", 0, -30, "north"),
      pin("-", "negative", 0, 30, "south"),
    ],
    primitives,
    variants: [],
    aliases: [id === "voltage-source" ? "dc-voltage" : "dc-current"],
  };
}

const diode: SymbolDefinition = {
  schemaVersion: 1,
  id: "diode",
  name: "Diode",
  viewBox: { x: -30, y: -16, width: 60, height: 32 },
  pins: [pin("A", "anode", -30, 0, "west"), pin("K", "cathode", 30, 0, "east")],
  primitives: [
    { kind: "line", from: { x: -30, y: 0 }, to: { x: -12, y: 0 } },
    {
      kind: "polygon",
      points: [
        { x: -12, y: -12 },
        { x: -12, y: 12 },
        { x: 10, y: 0 },
      ],
      fill: "none",
    },
    { kind: "line", from: { x: 10, y: -13 }, to: { x: 10, y: 13 } },
    { kind: "line", from: { x: 10, y: 0 }, to: { x: 30, y: 0 } },
  ],
  variants: [],
  aliases: ["rectifier-diode"],
};

function bjtSymbol(id: "npn" | "pnp", name: string): SymbolDefinition {
  const arrowPoints =
    id === "npn"
      ? [
          { x: 11, y: 15 },
          { x: 4, y: 13 },
          { x: 8, y: 8 },
        ]
      : [
          { x: 4, y: 9 },
          { x: 11, y: 11 },
          { x: 7, y: 16 },
        ];
  return {
    schemaVersion: 1,
    id,
    name,
    viewBox: { x: -30, y: -30, width: 60, height: 60 },
    pins: [
      pin("C", "collector", 15, -30, "north"),
      pin("B", "base", -30, 0, "west"),
      pin("E", "emitter", 15, 30, "south"),
    ],
    primitives: [
      { kind: "line", from: { x: -30, y: 0 }, to: { x: -8, y: 0 } },
      { kind: "line", from: { x: -8, y: -16 }, to: { x: -8, y: 16 } },
      { kind: "line", from: { x: -8, y: -8 }, to: { x: 15, y: -22 } },
      { kind: "line", from: { x: 15, y: -30 }, to: { x: 15, y: -22 } },
      { kind: "line", from: { x: -8, y: 8 }, to: { x: 15, y: 22 } },
      { kind: "line", from: { x: 15, y: 22 }, to: { x: 15, y: 30 } },
      { kind: "polygon", points: arrowPoints, fill: "foreground" },
    ],
    variants: [],
    aliases: [`bjt-${id}`],
  };
}

export const builtInSymbols: readonly SymbolDefinition[] = [
  resistor,
  capacitor,
  inductor,
  mosSymbol("nmos", "NMOS"),
  mosSymbol("pmos", "PMOS"),
  ground,
  port,
  sourceSymbol("voltage-source", "Independent Voltage Source"),
  sourceSymbol("current-source", "Independent Current Source"),
  diode,
  bjtSymbol("npn", "NPN Bipolar Transistor"),
  bjtSymbol("pnp", "PNP Bipolar Transistor"),
  genericBlock,
];
