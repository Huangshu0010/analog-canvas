import type { SymbolDefinition, SymbolPin } from "./schema.js";

function distribute(count: number, start: number, end: number): number[] {
  if (count <= 1) return [(start + end) / 2];
  return Array.from(
    { length: count },
    (_, index) => start + ((end - start) * index) / (count - 1),
  );
}

/** Geometry used only for a Project's derived subcircuit navigation blocks. */
export function createHierarchicalBlockGeometry(
  pinCount: number,
): SymbolDefinition {
  if (!Number.isInteger(pinCount) || pinCount < 1) {
    throw new Error("Hierarchical block pin count must be positive");
  }
  const leftCount = Math.ceil(pinCount / 2);
  const rightCount = pinCount - leftCount;
  const height = Math.max(
    40,
    Math.ceil(Math.max(leftCount, rightCount) / 2) * 40,
  );
  const leftY = distribute(leftCount, -height / 2 + 10, height / 2 - 10);
  const rightY = distribute(rightCount, -height / 2 + 10, height / 2 - 10);
  const pins: SymbolPin[] = [
    ...leftY.map((y, index) => ({
      name: String(index + 1),
      role: "hierarchical-port",
      at: { x: -40, y },
      direction: "west" as const,
      presentation: { visibility: "visible" as const, leadLength: 10 },
    })),
    ...rightY.map((y, index) => ({
      name: String(leftCount + index + 1),
      role: "hierarchical-port",
      at: { x: 40, y },
      direction: "east" as const,
      presentation: { visibility: "visible" as const, leadLength: 10 },
    })),
  ];
  return {
    schemaVersion: 1,
    id: "derived-hierarchical-block",
    name: "Hierarchical Block",
    viewBox: { x: -40, y: -height / 2, width: 80, height },
    pins,
    primitives: [
      {
        kind: "polyline",
        points: [
          { x: -30, y: -height / 2 },
          { x: 30, y: -height / 2 },
          { x: 30, y: height / 2 },
          { x: -30, y: height / 2 },
          { x: -30, y: -height / 2 },
        ],
      },
      ...pins.map((pin) => ({
        kind: "line" as const,
        from: pin.at,
        to: { x: pin.direction === "west" ? -30 : 30, y: pin.at.y },
      })),
    ],
    variants: [],
  };
}
