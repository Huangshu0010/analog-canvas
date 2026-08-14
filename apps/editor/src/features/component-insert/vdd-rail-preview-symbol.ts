import type { SymbolDefinition } from "@icm/symbols";

/**
 * Editor-only artwork for the virtual VDD Rail Library item. This definition
 * is deliberately absent from the product Symbol Resolver: it may be rendered
 * in the picker and placement preview, but it can never become an Instance.
 */
export const vddRailPreviewSymbol = {
  schemaVersion: 1,
  id: "vdd",
  name: "VDD Rail",
  viewBox: { x: -12, y: -2, width: 24, height: 26 },
  pins: [
    {
      name: "P",
      role: "power",
      at: { x: 0, y: 20 },
      direction: "south",
      presentation: { visibility: "visible", leadLength: 10 },
    },
  ],
  primitives: [
    {
      kind: "line",
      from: { x: 0, y: 20 },
      to: { x: 0, y: 1.5 },
      style: {
        strokeRole: "normal",
        lineCap: "butt",
        lineJoin: "miter",
      },
    },
    {
      kind: "polygon",
      points: [
        { x: -10, y: -0.88 },
        { x: 10, y: -0.88 },
        { x: 10, y: 2.36 },
        { x: -10, y: 2.36 },
      ],
      fill: "foreground",
      stroke: "none",
    },
  ],
  variants: [],
  labelVisibility: "hidden",
} satisfies SymbolDefinition;
