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
      { kind: "line", from: { x: 0, y: 0 }, to: { x: 30, y: 0 } },
      ...(id === "pmos"
        ? [{ kind: "circle" as const, center: { x: -6, y: 0 }, radius: 3 }]
        : []),
    ],
    variants: [{ id: "textbook-3terminal", hiddenPinNames: ["B"] }],
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

export const builtInSymbols: readonly SymbolDefinition[] = [
  resistor,
  capacitor,
  inductor,
  mosSymbol("nmos", "NMOS"),
  mosSymbol("pmos", "PMOS"),
  ground,
  port,
  genericBlock,
];
