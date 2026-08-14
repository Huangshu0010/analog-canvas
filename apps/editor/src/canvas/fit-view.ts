import type { Rect } from "@icm/model";

export interface DerivedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts renderer-derived bounds into the editor camera's grid-domain Rect.
 *
 * Rendering bounds may be fractional (text metrics, curves, and rotated
 * geometry), while the camera is deliberately constrained to integer grid
 * coordinates. Rounding outward preserves every visible pixel of the formal
 * scene without letting derived floats enter editor state.
 */
export function fitCameraToBounds(bounds: DerivedBounds, grid: number): Rect {
  if (
    !Number.isInteger(grid) ||
    grid <= 0 ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error(
      "Fit View requires finite positive bounds and an integer grid",
    );
  }

  const x = Math.floor(bounds.x / grid) * grid;
  const y = Math.floor(bounds.y / grid) * grid;
  const right = Math.ceil((bounds.x + bounds.width) / grid) * grid;
  const bottom = Math.ceil((bounds.y + bounds.height) / grid) * grid;
  return {
    x,
    y,
    width: Math.max(grid, right - x),
    height: Math.max(grid, bottom - y),
  };
}
