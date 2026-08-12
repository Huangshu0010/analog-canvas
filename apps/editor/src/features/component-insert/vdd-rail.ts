import type { Point } from "@icm/model";

import type { SchematicEdit } from "@icm/edit-engine";

export interface VddRailConstruction {
  instanceId: string;
  start: Point;
  end: Point;
}

/**
 * Persist the visual VDD rail as an ordinary editable Route rather than as a
 * stretchable Symbol. The unplaced VDD instance is the reviewed electrical
 * anchor that establishes the global VDD domain; the two route-anchor
 * Junctions and the rail itself own all visible geometry.
 */
export function constructVddRailEdits({
  instanceId,
  start,
  end,
}: VddRailConstruction): SchematicEdit[] {
  const key = instanceId.toLowerCase();
  const netId = `net-power-${key}`;
  const startJunctionId = `junction-${key}-start`;
  const endJunctionId = `junction-${key}-end`;
  const rightJunctionId = start.x <= end.x ? endJunctionId : startJunctionId;
  const right = start.x <= end.x ? end : start;

  return [
    {
      kind: "add_instance",
      instance: {
        id: instanceId,
        symbolId: "vdd",
        placement: null,
        properties: {},
      },
    },
    {
      kind: "connect_endpoints",
      from: { kind: "terminal", instanceId, pinName: "P" },
      to: { kind: "terminal", instanceId, pinName: "P" },
      newNetId: netId,
      newNetName: "VDD",
      newNetScope: "global",
    },
    {
      kind: "add_junction",
      junctionId: startJunctionId,
      netId,
      position: start,
      role: "route-anchor",
    },
    {
      kind: "add_junction",
      junctionId: endJunctionId,
      netId,
      position: end,
      role: "route-anchor",
    },
    {
      kind: "set_route_points",
      routeId: `route-${key}-rail`,
      netId,
      from: { kind: "junction", junctionId: startJunctionId },
      to: { kind: "junction", junctionId: endJunctionId },
      waypoints: [],
      segmentModes: ["manual"],
      presentation: "power-rail",
    },
    {
      kind: "upsert_annotation",
      annotation: {
        id: `label-${instanceId}`,
        kind: "power-label",
        text: "VDD",
        position: { x: right.x + 6, y: right.y + 5 },
        attachedObjectId: rightJunctionId,
        offset: { x: 6, y: 5 },
        alignment: "start",
        rotation: 0,
        locked: false,
      },
    },
  ];
}
