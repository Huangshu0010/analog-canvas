import { planEnsureNamedNet, type SchematicEdit } from "@icm/edit-engine";
import { deriveStableId, type SchematicDocument } from "@icm/model";
import { resolveDocumentLogicalNets } from "@icm/derived";

import { proposedSupplyPortRename } from "../component-insert/placement-connectivity";

export type ElectricalMarkerNamePlan =
  | { status: "noop" }
  | { status: "rejected"; message: string }
  | { status: "ready"; edits: readonly SchematicEdit[]; message: string };

/**
 * Properties-domain name planning for electrical markers. Free Net Ports and
 * supply markers share one field in the inspector but deliberately keep their
 * different electrical planners.
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
    document.netlist?.terminals.some((terminal) =>
      terminal.interfaceInstanceIds.includes(instanceId),
    )
  ) {
    return { status: "rejected", message: "Formal Cell Pins use Cell naming" };
  }
  if (
    instance.symbolId !== "port" &&
    instance.symbolId !== "port-filled" &&
    instance.symbolId !== "vdd-port"
  ) {
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

  if (instance.symbolId === "vdd-port") {
    const plan = proposedSupplyPortRename(document, instance, name);
    return plan.rejected
      ? { status: "rejected", message: plan.rejected }
      : { status: "ready", edits: plan.edits, message: `Supply named ${name}` };
  }

  const plan = planEnsureNamedNet(document, {
    candidateNetId: net.id,
    name,
    evidenceId:
      document.connectivityEvidence.find(
        (evidence) =>
          evidence.kind === "name-claim" &&
          evidence.owner.kind === "free-port" &&
          evidence.owner.instanceId === instanceId,
      )?.id ??
      deriveStableId(
        "connectivity-evidence",
        document.id,
        "free-port",
        net.id,
        instanceId,
      ),
    owner: { kind: "free-port", instanceId },
  });
  return plan.ok
    ? {
        status: "ready",
        edits: plan.edits,
        message: `Renamed Net Port to ${plan.name}`,
      }
    : { status: "rejected", message: plan.message };
}
