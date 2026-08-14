import type { Point } from "@icm/model";

import type { SchematicEdit } from "@icm/edit-engine";

export interface VddRailConstruction {
  instanceId: string;
  start: Point;
  end: Point;
  netId?: string;
}

/**
 * Persist the visual VDD rail as an ordinary editable Route rather than as a
 * stretchable Symbol. The explicitly tagged Net is the electrical authority;
 * its route anchors and rail own all visible geometry.
 */
export function constructVddRailEdits({
  instanceId,
  start,
  end,
  netId,
}: VddRailConstruction): SchematicEdit[] {
  const key = instanceId.toLowerCase();
  const targetNetId = netId ?? `net-power-${key}`;
  const startJunctionId = `junction-${key}-start`;
  const endJunctionId = `junction-${key}-end`;
  return [
    {
      kind: "add_power_rail",
      netId: targetNetId,
      routeId: `route-${key}-rail`,
      startJunctionId,
      endJunctionId,
      labelId: `label-${instanceId}`,
      domain: "vdd",
      start,
      end,
    },
  ];
}
