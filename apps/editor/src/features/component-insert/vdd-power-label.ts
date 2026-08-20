import type { Annotation, Point } from "@icm/model";

/**
 * The placed VDD power port keeps the reviewed marker artwork (a filled bar
 * with a hidden default label), so its visible "VDD" text is a separate
 * power-label annotation — the same semantic typography the drawn rail uses.
 * The id prefix differs from the rail's `label-` prefix so a device and a rail
 * can never overwrite each other's label.
 */
export function vddPowerLabelAnnotation(options: {
  instanceId: string;
  netId: string;
  position: Point;
}): Annotation {
  return {
    id: `power-label-${options.instanceId.toLowerCase()}`,
    kind: "power-label",
    binding: { kind: "net-name", netId: options.netId },
    netId: options.netId,
    anchor: {
      kind: "object",
      objectId: options.instanceId,
      // Both offset fields are page-grid coordinates; {10, 10} matches the
      // drawn rail label's offset from its anchor.
      localOffset: { x: 10, y: 10 },
      fallbackPosition: {
        x: options.position.x + 10,
        y: options.position.y + 10,
      },
    },
    alignment: "start",
    rotation: 0,
    locked: false,
  };
}
