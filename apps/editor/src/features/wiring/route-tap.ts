import type { Point } from "@icm/model";

export interface RouteTap {
  segmentIndex: number;
  point: Point;
  distanceSquared: number;
}

/**
 * Resolve a pointer position to the nearest point on an orthogonal route.
 *
 * SVG gives the route a wide transparent hit stroke in screen pixels. The old
 * code threw that tolerance away by demanding exact logical-coordinate
 * equality after grid snapping, so a click that visibly hit a wire often could
 * not make a junction. Keep the hit and topology layers consistent: project
 * to the segment, retain the closest in-tolerance candidate, and use that
 * exact projected point for a subsequent route split.
 *
 * Extracted verbatim from `apps/editor/src/app/App.tsx` (WP-R4) so the route-
 * tap hit contract is testable and reusable independently of the App
 * component. The behavior is unchanged.
 */
export function resolveRouteTap(
  points: readonly Point[],
  pointer: Point,
  tolerance: number,
): RouteTap | null {
  // A geometric bend is a virtual snap target. Prefer it before projecting
  // onto either of its two segments, otherwise an off-axis click near a corner
  // becomes a point beside the bend and yields a visibly skewed branch.
  let nearestVertex: RouteTap | null = null;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const dx = pointer.x - point.x;
    const dy = pointer.y - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > tolerance * tolerance) continue;
    if (
      !nearestVertex ||
      distanceSquared < nearestVertex.distanceSquared ||
      (distanceSquared === nearestVertex.distanceSquared &&
        index - 1 < nearestVertex.segmentIndex)
    ) {
      nearestVertex = {
        segmentIndex: index - 1,
        point: { ...point },
        distanceSquared,
      };
    }
  }
  if (nearestVertex) return nearestVertex;

  let best: RouteTap | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (from.x !== to.x && from.y !== to.y) continue;
    const point =
      from.x === to.x
        ? {
            x: from.x,
            y: Math.max(
              Math.min(pointer.y, Math.max(from.y, to.y)),
              Math.min(from.y, to.y),
            ),
          }
        : {
            x: Math.max(
              Math.min(pointer.x, Math.max(from.x, to.x)),
              Math.min(from.x, to.x),
            ),
            y: from.y,
          };
    const dx = pointer.x - point.x;
    const dy = pointer.y - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > tolerance * tolerance) continue;
    if (
      !best ||
      distanceSquared < best.distanceSquared ||
      (distanceSquared === best.distanceSquared && index < best.segmentIndex)
    ) {
      best = { segmentIndex: index, point, distanceSquared };
    }
  }
  return best;
}
