import type { Mirror, Orientation, Point, Rotation } from "./schema.js";

function mirrorLocal(point: Point, mirror: Mirror): Point {
  return mirror === "x" ? { x: -point.x, y: point.y } : point;
}

function rotateLocal(point: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return point;
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
  }
}

function inverseRotateLocal(point: Point, rotation: Rotation): Point {
  return rotateLocal(point, ((360 - rotation) % 360) as Rotation);
}

export function transformPoint(
  localPoint: Point,
  origin: Point,
  orientation: Orientation,
): Point {
  const transformed = rotateLocal(
    mirrorLocal(localPoint, orientation.mirror),
    orientation.rotation,
  );
  return {
    x: origin.x + transformed.x,
    y: origin.y + transformed.y,
  };
}

export function inverseTransformPoint(
  worldPoint: Point,
  origin: Point,
  orientation: Orientation,
): Point {
  const translated = {
    x: worldPoint.x - origin.x,
    y: worldPoint.y - origin.y,
  };
  const rotated = inverseRotateLocal(translated, orientation.rotation);
  return mirrorLocal(rotated, orientation.mirror);
}

export function manhattanDistance(left: Point, right: Point): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
