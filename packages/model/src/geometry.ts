import type {
  DerivedPoint,
  GridPoint,
  Mirror,
  Orientation,
  Rotation,
  SymbolLocalPoint,
} from "./schema.js";

function mirrorLocal(
  point: GridPoint | SymbolLocalPoint,
  mirror: Mirror,
): DerivedPoint {
  return mirror === "x" ? { x: -point.x, y: point.y } : point;
}

function rotateLocal(point: DerivedPoint, rotation: Rotation): DerivedPoint {
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

function inverseRotateLocal(
  point: DerivedPoint,
  rotation: Rotation,
): DerivedPoint {
  return rotateLocal(point, ((360 - rotation) % 360) as Rotation);
}

export function transformPoint(
  localPoint: GridPoint | SymbolLocalPoint,
  origin: GridPoint,
  orientation: Orientation,
): DerivedPoint {
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
  worldPoint: DerivedPoint,
  origin: GridPoint,
  orientation: Orientation,
): DerivedPoint {
  const translated = {
    x: worldPoint.x - origin.x,
    y: worldPoint.y - origin.y,
  };
  const rotated = inverseRotateLocal(translated, orientation.rotation);
  return mirrorLocal(rotated, orientation.mirror);
}

export function manhattanDistance(
  left: GridPoint | DerivedPoint,
  right: GridPoint | DerivedPoint,
): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
