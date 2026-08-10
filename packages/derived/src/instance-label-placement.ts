import { transformPoint } from "@icm/model";
import type { Point, Rect, SchematicDocument } from "@icm/model";
import type { ResolvedSymbol } from "@icm/symbols";

import type { SchematicStyleProfile } from "./style-profile.js";
import { visibleSymbolLocalBounds } from "./visual.js";

export interface InstanceLabelPlacement {
  readonly position: Point;
  readonly semanticPosition: Point;
  readonly alignment: "start" | "middle" | "end";
}

export type InstanceLabelSide = "left" | "right" | "top" | "bottom";

const SIDE_LABEL_SYMBOLS = new Set([
  "resistor",
  "capacitor",
  "inductor",
  "voltage-source",
  "current-source",
  "ac-voltage-source",
  "pulse-voltage-source",
]);

export function isMosSymbol(resolved: ResolvedSymbol): boolean {
  const roles = new Set(resolved.definition.pins.map((pin) => pin.role));
  return roles.has("gate") && roles.has("drain") && roles.has("source");
}

function transformedBounds(
  localBounds: Rect,
  instance: SchematicDocument["instances"][number],
): Rect | null {
  if (!instance.placement) return null;
  const corners = [
    { x: localBounds.x, y: localBounds.y },
    { x: localBounds.x + localBounds.width, y: localBounds.y },
    {
      x: localBounds.x + localBounds.width,
      y: localBounds.y + localBounds.height,
    },
    { x: localBounds.x, y: localBounds.y + localBounds.height },
  ].map((point) =>
    transformPoint(point, instance.placement!.position, instance.placement!),
  );
  const left = Math.min(...corners.map((point) => point.x));
  const right = Math.max(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const bottom = Math.max(...corners.map((point) => point.y));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function inferInstanceLabelSide(
  localAnchor: Point,
  localBounds: Rect,
): InstanceLabelSide | null {
  const center = {
    x: localBounds.x + localBounds.width / 2,
    y: localBounds.y + localBounds.height / 2,
  };
  const displacement = {
    x: (localAnchor.x - center.x) / Math.max(localBounds.width / 2, 1),
    y: (localAnchor.y - center.y) / Math.max(localBounds.height / 2, 1),
  };
  if (displacement.x === 0 && displacement.y === 0) return null;
  if (Math.abs(displacement.x) >= Math.abs(displacement.y)) {
    return displacement.x > 0 ? "right" : "left";
  }
  return displacement.y > 0 ? "bottom" : "top";
}

function sideClearance(
  localAnchor: Point,
  localBounds: Rect,
  side: InstanceLabelSide,
): number {
  switch (side) {
    case "left":
      return localBounds.x - localAnchor.x;
    case "right":
      return localAnchor.x - (localBounds.x + localBounds.width);
    case "top":
      return localBounds.y - localAnchor.y;
    case "bottom":
      return localAnchor.y - (localBounds.y + localBounds.height);
  }
}

function transformedSide(
  side: InstanceLabelSide,
  instance: SchematicDocument["instances"][number],
): InstanceLabelSide | null {
  if (!instance.placement) return null;
  const vector =
    side === "left"
      ? { x: -1, y: 0 }
      : side === "right"
        ? { x: 1, y: 0 }
        : side === "top"
          ? { x: 0, y: -1 }
          : { x: 0, y: 1 };
  const world = transformPoint(vector, { x: 0, y: 0 }, instance.placement);
  if (world.x > 0) return "right";
  if (world.x < 0) return "left";
  return world.y > 0 ? "bottom" : "top";
}

/**
 * Places horizontal SVG text around the active symbol variant. `localAnchor`
 * remains the semantic transform point; vertical sides convert between that
 * point and an upright glyph baseline so the visible glyph edge, rather than
 * the baseline itself, preserves the authored clearance.
 */
export function placeUprightInstanceLabel(
  instance: SchematicDocument["instances"][number],
  resolved: ResolvedSymbol,
  profile: SchematicStyleProfile,
  localAnchor: Point,
  localSide: InstanceLabelSide,
  sizeScale = 1,
  minimumClearance = 1.5,
): InstanceLabelPlacement | null {
  if (!instance.placement) return null;
  const localBounds = visibleSymbolLocalBounds(resolved);
  const worldBounds = transformedBounds(localBounds, instance);
  const worldSide = transformedSide(localSide, instance);
  if (!worldBounds || !worldSide) return null;
  const semanticPosition = transformPoint(
    localAnchor,
    instance.placement.position,
    instance.placement,
  );
  const clearance = Math.max(
    minimumClearance,
    sideClearance(localAnchor, localBounds, localSide),
  );
  const fontSize = profile.typography.instanceFontSize * sizeScale;
  const roundedSemanticPosition = {
    x: Math.round(semanticPosition.x),
    y: Math.round(semanticPosition.y),
  };
  switch (worldSide) {
    case "right":
      return {
        position: {
          x: Math.round(worldBounds.x + worldBounds.width + clearance),
          y: Math.round(semanticPosition.y),
        },
        semanticPosition: roundedSemanticPosition,
        alignment: "start",
      };
    case "left":
      return {
        position: {
          x: Math.round(worldBounds.x - clearance),
          y: Math.round(semanticPosition.y),
        },
        semanticPosition: roundedSemanticPosition,
        alignment: "end",
      };
    case "bottom":
      return {
        position: {
          x: Math.round(semanticPosition.x),
          y: Math.round(
            worldBounds.y + worldBounds.height + clearance + fontSize * 1.05,
          ),
        },
        semanticPosition: roundedSemanticPosition,
        alignment: "middle",
      };
    case "top":
      return {
        position: {
          x: Math.round(semanticPosition.x),
          y: Math.round(worldBounds.y - clearance - fontSize * 0.3),
        },
        semanticPosition: roundedSemanticPosition,
        alignment: "middle",
      };
  }
}

function localRightmostChannelPin(resolved: ResolvedSymbol): number {
  const channelPins = resolved.definition.pins.filter(
    (pin) => pin.role !== "bulk",
  );
  return Math.max(...channelPins.map((pin) => pin.at.x));
}

/** Supplies canonical placement for renderer-owned instance labels. */
export function defaultInstanceLabelPlacement(
  instance: SchematicDocument["instances"][number],
  resolved: ResolvedSymbol,
  profile: SchematicStyleProfile,
): InstanceLabelPlacement | null {
  if (!instance.placement) return null;
  const viewBox = resolved.definition.viewBox;
  const middleY = viewBox.y + viewBox.height / 2;
  const middleX = viewBox.x + viewBox.width / 2;
  const compactSideGap = 1.5;
  const baselineOffset = profile.typography.instanceFontSize * 0.35;

  if (instance.symbolId === "port" || instance.symbolId === "port-filled") {
    const localPosition = {
      x: viewBox.x - compactSideGap,
      y: middleY + baselineOffset,
    };
    const position = transformPoint(
      localPosition,
      instance.placement.position,
      instance.placement,
    );
    return {
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      semanticPosition: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
      alignment:
        transformedSide("left", instance) === "left"
          ? "end"
          : transformedSide("left", instance) === "right"
            ? "start"
            : "middle",
    };
  }

  if (isMosSymbol(resolved)) {
    const mosSideGap = Math.max(
      8,
      profile.typography.labelGap + profile.typography.instanceFontSize * 0.3,
    );
    const localPosition = {
      x: localRightmostChannelPin(resolved) + mosSideGap * 0.6,
      y: middleY + profile.typography.instanceFontSize * 0.55,
    };
    return placeUprightInstanceLabel(
      instance,
      resolved,
      profile,
      localPosition,
      "right",
    );
  }

  if (SIDE_LABEL_SYMBOLS.has(instance.symbolId)) {
    const localPosition = {
      x: viewBox.x + viewBox.width + compactSideGap,
      y: middleY + baselineOffset,
    };
    const position = transformPoint(
      localPosition,
      instance.placement.position,
      instance.placement,
    );
    const side = transformedSide("right", instance);
    return {
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      semanticPosition: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
      alignment:
        side === "right" ? "start" : side === "left" ? "end" : "middle",
    };
  }

  const bottomGap =
    profile.id === "textbook-monochrome-v1"
      ? 14
      : profile.typography.labelGap + profile.typography.instanceFontSize;
  const position = transformPoint(
    { x: middleX, y: viewBox.y + viewBox.height + bottomGap },
    instance.placement.position,
    instance.placement,
  );
  return {
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    semanticPosition: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    alignment: "middle",
  };
}
