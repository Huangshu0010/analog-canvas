import { planEnsurePowerNet, type SchematicEdit } from "@icm/edit-engine";
import type { Point, SchematicDocument } from "@icm/model";

export interface VddRailConstruction {
  instanceId: string;
  start: Point;
  end: Point;
  netId?: string;
}

export type VddRailPlan =
  | { ok: true; netId: string; edits: readonly SchematicEdit[] }
  | { ok: false; message: string };

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

/** Resolve VDD by canonical name before constructing its visual rail. */
export function planVddRailEdits(
  document: SchematicDocument,
  construction: VddRailConstruction,
): VddRailPlan {
  const candidateNetId =
    construction.netId ?? `net-power-${construction.instanceId.toLowerCase()}`;
  const plan = planEnsurePowerNet(document, {
    candidateNetId,
    candidateState: document.nets.some((net) => net.id === candidateNetId)
      ? "existing"
      : "created-power",
    domain: "vdd",
  });
  if (!plan.ok) return { ok: false, message: plan.message };
  return {
    ok: true,
    netId: plan.netId,
    edits: [
      ...plan.edits,
      ...constructVddRailEdits({ ...construction, netId: plan.netId }),
    ],
  };
}
