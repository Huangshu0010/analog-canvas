import { transformPoint } from "@icm/model";
import type { Point, SchematicDocument } from "@icm/model";
import type { SymbolDefinition } from "@icm/symbols";

import type { SchematicStyleProfile } from "./style-profile.js";

export interface DefaultInstanceLabelPlacement {
  readonly position: Point;
  readonly alignment: "start" | "middle" | "end";
}

const SIDE_LABEL_SYMBOLS = new Set([
  "resistor",
  "capacitor",
  "inductor",
  "voltage-source",
  "current-source",
  "ac-voltage-source",
  "pulse-voltage-source",
]);

const MOS_SYMBOLS = new Set(["nmos", "pmos", "nmos3", "pmos3"]);

function localRightmostPin(definition: SymbolDefinition): number {
  const channelPins = definition.pins.filter((pin) => pin.role !== "bulk");
  return Math.max(...channelPins.map((pin) => pin.at.x));
}

function transformedSideAlignment(
  instance: SchematicDocument["instances"][number],
  localPosition: Point,
  localOutward: Point,
): "start" | "middle" | "end" {
  const placement = instance.placement;
  if (!placement) return "middle";
  const anchor = transformPoint(localPosition, placement.position, placement);
  const outward = transformPoint(
    {
      x: localPosition.x + localOutward.x,
      y: localPosition.y + localOutward.y,
    },
    placement.position,
    placement,
  );
  const dx = outward.x - anchor.x;
  const dy = outward.y - anchor.y;
  if (Math.abs(dx) <= Math.abs(dy)) return "middle";
  return dx > 0 ? "start" : "end";
}

/**
 * Supplies the initial placement for an instance label only. Persisted label
 * annotations are authoritative and deliberately do not pass through here.
 */
export function defaultInstanceLabelPlacement(
  instance: SchematicDocument["instances"][number],
  definition: SymbolDefinition,
  profile: SchematicStyleProfile,
): DefaultInstanceLabelPlacement | null {
  const placement = instance.placement;
  if (!placement) return null;

  const viewBox = definition.viewBox;
  const middleY = viewBox.y + viewBox.height / 2;
  const middleX = viewBox.x + viewBox.width / 2;
  const mosSideGap = Math.max(
    8,
    profile.typography.labelGap + profile.typography.instanceFontSize * 0.3,
  );
  // Passives, independent sources, and Ports use a deliberately fixed visual
  // clearance from their symbol box. This is an authored-canvas unit, not a
  // typography-derived gap: their labels must sit close to the symbol at every
  // supported text scale.
  const compactSideGap = 1.5;
  const baselineOffset = profile.typography.instanceFontSize * 0.35;
  let localPosition: Point;
  let localOutward: Point | null = null;

  if (instance.symbolId === "port" || instance.symbolId === "port-filled") {
    // The Port's pin and short lead face right in local space. Its label belongs
    // on the opposite continuation of the visible endpoint.
    localPosition = {
      x: viewBox.x - compactSideGap,
      y: middleY + baselineOffset,
    };
    localOutward = { x: -1, y: 0 };
  } else if (MOS_SYMBOLS.has(instance.symbolId)) {
    // Gate is local-left; leave its wire lane clear and name the device on the
    // channel's other side, slightly toward the lower source side.
    localPosition = {
      x: localRightmostPin(definition) + mosSideGap * 0.6,
      y: middleY + profile.typography.instanceFontSize * 0.55,
    };
    localOutward = { x: 1, y: 0 };
  } else if (SIDE_LABEL_SYMBOLS.has(instance.symbolId)) {
    localPosition = {
      x: viewBox.x + viewBox.width + compactSideGap,
      y: middleY + baselineOffset,
    };
    localOutward = { x: 1, y: 0 };
  } else {
    const bottomGap =
      profile.id === "textbook-monochrome-v1"
        ? 14
        : profile.typography.labelGap + profile.typography.instanceFontSize;
    localPosition = { x: middleX, y: viewBox.y + viewBox.height + bottomGap };
  }

  const position = transformPoint(localPosition, placement.position, placement);
  return {
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    alignment: localOutward
      ? transformedSideAlignment(instance, localPosition, localOutward)
      : "middle",
  };
}
