import type { Point, ScreenFlip } from "@icm/model";

/** Editor-only affine pose used by live interaction previews. */
export interface CanvasAffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY_CANVAS_TRANSFORM: CanvasAffineTransform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

/** Compose transforms so `inner` is applied first and `outer` second. */
export function composeCanvasTransforms(
  outer: CanvasAffineTransform,
  inner: CanvasAffineTransform,
): CanvasAffineTransform {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    e: outer.a * inner.e + outer.c * inner.f + outer.e,
    f: outer.b * inner.e + outer.d * inner.f + outer.f,
  };
}

export function translationTransform(delta: Point): CanvasAffineTransform {
  return { ...IDENTITY_CANVAS_TRANSFORM, e: delta.x, f: delta.y };
}

export function quarterTurnTransform(
  pivot: Point,
  deltaDegrees: 90 | -90,
): CanvasAffineTransform {
  return deltaDegrees === 90
    ? { a: 0, b: 1, c: -1, d: 0, e: pivot.x + pivot.y, f: pivot.y - pivot.x }
    : { a: 0, b: -1, c: 1, d: 0, e: pivot.x - pivot.y, f: pivot.x + pivot.y };
}

export function reflectionTransform(
  pivot: Point,
  direction: ScreenFlip,
): CanvasAffineTransform {
  return direction === "left-right"
    ? { a: -1, b: 0, c: 0, d: 1, e: 2 * pivot.x, f: 0 }
    : { a: 1, b: 0, c: 0, d: -1, e: 0, f: 2 * pivot.y };
}

export function transformCanvasPoint(
  transform: CanvasAffineTransform,
  point: Point,
): Point {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

export function canvasTransformAttribute(
  transform: CanvasAffineTransform,
): string {
  return `matrix(${transform.a} ${transform.b} ${transform.c} ${transform.d} ${transform.e} ${transform.f})`;
}
