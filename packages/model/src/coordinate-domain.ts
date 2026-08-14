import type { DerivedPoint, GridPoint, GridRect } from "./schema.js";

/**
 * Read-only geometry (text metrics, curves, pointer previews) can be
 * fractional. This is the only conversion back into the persisted document
 * coordinate domain.
 */
export function snapGridCoordinate(value: number, grid: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(grid) || grid <= 0) {
    throw new Error(
      "Grid normalization requires finite coordinates and a positive integer grid",
    );
  }
  return Math.round(value / grid) * grid;
}

export function snapGridPoint(
  point: Pick<DerivedPoint, "x" | "y">,
  grid: number,
): GridPoint {
  return {
    x: snapGridCoordinate(point.x, grid),
    y: snapGridCoordinate(point.y, grid),
  };
}

export function snapGridRect(
  rect: Pick<GridRect, "x" | "y" | "width" | "height">,
  grid: number,
): GridRect {
  return {
    x: snapGridCoordinate(rect.x, grid),
    y: snapGridCoordinate(rect.y, grid),
    width: Math.max(grid, snapGridCoordinate(rect.width, grid)),
    height: Math.max(grid, snapGridCoordinate(rect.height, grid)),
  };
}

export function isGridAlignedCoordinate(value: number, grid: number): boolean {
  return (
    Number.isInteger(value) &&
    Number.isInteger(grid) &&
    grid > 0 &&
    value % grid === 0
  );
}
