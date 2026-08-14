import type { DerivedRect, GridRect } from "@icm/model";

export interface CameraRectInput {
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
function assertFinitePositiveRect(
  bounds: CameraRectInput,
  grid: number,
  operation: string,
): void {
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
      `${operation} requires finite positive bounds and an integer grid`,
    );
  }
}

/**
 * Quantizes an editor viewport to the current Document grid. Camera is
 * transient, but retaining the same grid contract prevents it from becoming a
 * covert float path into SVG rendering and pointer conversion.
 */
export function normalizeCameraRect(
  rect: CameraRectInput,
  grid: number,
): GridRect {
  assertFinitePositiveRect(rect, grid, "Camera normalization");
  const snap = (value: number) => Math.round(value / grid) * grid;
  return {
    x: snap(rect.x),
    y: snap(rect.y),
    width: Math.max(grid, snap(rect.width)),
    height: Math.max(grid, snap(rect.height)),
  };
}

/**
 * Converts renderer-derived bounds into the editor camera's grid-domain Rect.
 * Unlike ordinary camera normalization, fit expands outward so no formal
 * visual geometry is clipped.
 */
export function fitCameraToBounds(bounds: DerivedRect, grid: number): GridRect {
  assertFinitePositiveRect(bounds, grid, "Fit View");

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
