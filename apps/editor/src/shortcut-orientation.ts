import type { Orientation, Rotation } from "@icm/model";

/** The visible direction of a reflection in document coordinates. */
export type ScreenFlip = "left-right" | "top-bottom";

/**
 * Compose a screen-space reflection with the canonical orientation transform
 * (`rotate(mirror(local))`). The persisted representation deliberately has one
 * mirror bit: its four rotations form the other reflection direction without
 * needing another schema or edit kind.
 */
export function reflectOrientation(
  orientation: Orientation,
  direction: ScreenFlip,
): Orientation {
  const baseRotation = direction === "left-right" ? 0 : 180;
  return {
    rotation: ((baseRotation - orientation.rotation + 360) % 360) as Rotation,
    mirror: orientation.mirror === "none" ? "x" : "none",
  };
}
