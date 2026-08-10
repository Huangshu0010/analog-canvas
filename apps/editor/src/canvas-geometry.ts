import type { Point, Rect } from "@icm/model";

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Closest point on an orthogonal canvas segment. */
export function closestPointOnSegment(
  point: Point,
  from: Point,
  to: Point,
): Point {
  if (from.x === to.x) {
    return {
      x: from.x,
      y: clamp(point.y, Math.min(from.y, to.y), Math.max(from.y, to.y)),
    };
  }
  return {
    x: clamp(point.x, Math.min(from.x, to.x), Math.max(from.x, to.x)),
    y: from.y,
  };
}

export function centerOfBounds(bounds: Rect): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function rotatePointByDegrees(
  point: Point,
  pivot: Point,
  degrees: number,
): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: Math.round(pivot.x + dx * cos - dy * sin),
    y: Math.round(pivot.y + dx * sin + dy * cos),
  };
}

export function normalizedBearing(from: Point, to: Point): number {
  return (
    ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360
  );
}
