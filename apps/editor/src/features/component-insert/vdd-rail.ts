import type { SchematicEdit } from "@icm/edit-engine";
import { foldNetName, type Point, type SchematicDocument } from "@icm/model";

import { planInitialMosBulkDefault } from "./mos-bulk-defaults";

export interface VddRailConstruction {
  instanceId: string;
  start: Point;
  end: Point;
  netId?: string;
  netName?: string;
  scope?: "local" | "global";
}

export type VddRailPlan =
  | { ok: true; netId: string; edits: readonly SchematicEdit[] }
  | { ok: false; message: string };

/**
 * Constrain a snapped pointer to one straight Power Rail axis. The dominant
 * delta selects the axis and ties retain the established horizontal gesture.
 * Preview and commit must both use this one projection.
 */
export function constrainedPowerRailEndpoint(
  start: Point,
  pointer: Point,
): Point {
  const dx = pointer.x - start.x;
  const dy = pointer.y - start.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: pointer.x, y: start.y }
    : { x: start.x, y: pointer.y };
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
  netName = "VDD",
  scope = "local",
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
      netName,
      scope,
      powerDomain: "vdd",
      start,
      end,
    },
  ];
}

/** Resolve a named supply before constructing its visual rail. */
export function planVddRailEdits(
  document: SchematicDocument,
  construction: VddRailConstruction,
): VddRailPlan {
  const netName = construction.netName?.trim() || "VDD";
  const requested = construction.netId
    ? document.nets.find((net) => net.id === construction.netId)
    : undefined;
  if (requested?.name && foldNetName(requested.name) !== foldNetName(netName)) {
    return {
      ok: false,
      message: `Power rail target ${requested.name} does not match ${netName}`,
    };
  }
  const named = document.nets.find(
    (net) => net.name && foldNetName(net.name) === foldNetName(netName),
  );
  if (requested && named && requested.id !== named.id) {
    return {
      ok: false,
      message: `Power rail target ${requested.id} conflicts with existing named Net ${named.id}`,
    };
  }
  const target = requested ?? named;
  if (
    target &&
    (target.powerDomain ?? "none") !== "none" &&
    (target.powerDomain ?? "none") !== "vdd"
  ) {
    return {
      ok: false,
      message: `Power rail target ${netName} has incompatible role ${target.powerDomain}`,
    };
  }
  const netId =
    target?.id ?? `net-power-${construction.instanceId.toLowerCase()}`;
  return {
    ok: true,
    netId,
    edits: [
      ...(target && !target.name
        ? [
            {
              kind: "set_net_name" as const,
              netId: target.id,
              name: netName,
            },
          ]
        : []),
      ...(target && (target.powerDomain ?? "none") === "none"
        ? [
            {
              kind: "set_net_power_domain" as const,
              netId: target.id,
              powerDomain: "vdd" as const,
            },
          ]
        : []),
      ...constructVddRailEdits({
        ...construction,
        netId,
        netName: target?.name ?? netName,
        scope: target?.scope ?? construction.scope ?? "local",
      }),
      ...planInitialMosBulkDefault(document, "vdd", netId),
    ],
  };
}
