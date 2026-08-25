import type { SchematicEdit } from "@icm/edit-engine";
import type { SchematicDocument } from "@icm/model";
import { resolveDocumentLogicalNets } from "@icm/derived";

import { proposedSupplyPortRename } from "../component-insert/placement-connectivity";

export type ElectricalMarkerNamePlan =
  | { status: "noop" }
  | { status: "rejected"; message: string }
  | { status: "ready"; edits: readonly SchematicEdit[]; message: string };

/**
 * Properties-domain name planning for supply markers. Formal Cell Pins are
 * renamed through the hierarchy planner and Net Labels own local Net names.
 */
export function planElectricalMarkerName(
  document: SchematicDocument,
  instanceId: string,
  rawName: string,
): ElectricalMarkerNamePlan {
  const instance = document.instances.find(
    (candidate) => candidate.id === instanceId,
  );
  if (!instance) {
    return { status: "rejected", message: "Electrical marker is unavailable" };
  }
  if (
    document.netlist?.terminals.some(
      (terminal) => terminal.interfaceInstanceId === instanceId,
    )
  ) {
    return { status: "rejected", message: "Formal Cell Pins use Cell naming" };
  }
  if (instance.symbolId !== "vdd-port") {
    return {
      status: "rejected",
      message: "Instance is not an electrical marker",
    };
  }
  const net = document.nets.find((candidate) =>
    candidate.terminals.some((terminal) => terminal.instanceId === instanceId),
  );
  if (!net) {
    return { status: "rejected", message: "Electrical marker has no Net" };
  }
  const name = rawName.trim();
  const currentName = resolveDocumentLogicalNets(document).byBaseNetId.get(
    net.id,
  )?.name;
  if (!name || name === currentName) return { status: "noop" };

  const plan = proposedSupplyPortRename(document, instance, name);
  return plan.rejected
    ? { status: "rejected", message: plan.rejected }
    : { status: "ready", edits: plan.edits, message: `Supply named ${name}` };
}
