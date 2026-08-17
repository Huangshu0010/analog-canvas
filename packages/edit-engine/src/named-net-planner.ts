import { foldNetName } from "@icm/model";

import type { SchematicEdit } from "./edit-schema.js";

export type EnsureNamedNetPlan =
  | { ok: true; netId: string; name: string; edits: readonly SchematicEdit[] }
  | { ok: false; message: string; relatedNetIds: readonly string[] };

/** Minimal read contract keeps planner consumers independent of Document I/O. */
export interface NamedNetPlannerDocument {
  nets: readonly {
    id: string;
    name?: string | undefined;
    powerDomain?: "none" | "vdd" | "ground" | "conflict" | undefined;
  }[];
}

/**
 * Name-first authoring over one existing candidate Net. The returned edits are
 * ordinary typed edits: low-level callers still retain the raw rename/merge
 * contract, while GUI-level label authoring gets one deterministic operation.
 */
export function planEnsureNamedNet(
  document: NamedNetPlannerDocument,
  request: { candidateNetId: string; name: string },
): EnsureNamedNetPlan {
  const candidate = document.nets.find(
    (net) => net.id === request.candidateNetId,
  );
  if (!candidate) {
    return {
      ok: false,
      message: `Named Net candidate does not exist: ${request.candidateNetId}`,
      relatedNetIds: [request.candidateNetId],
    };
  }
  const name = request.name.trim();
  const foldedName = foldNetName(name);
  const matches = document.nets
    .filter((net) => net.name && foldNetName(net.name) === foldedName)
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  const target = matches[0];
  if (!target) {
    return {
      ok: true,
      netId: candidate.id,
      name,
      edits:
        candidate.name === name
          ? []
          : [{ kind: "set_net_name", netId: candidate.id, name }],
    };
  }
  if (target.id === candidate.id) {
    return { ok: true, netId: target.id, name: target.name!, edits: [] };
  }
  const targetRole = target.powerDomain ?? "none";
  const candidateRole = candidate.powerDomain ?? "none";
  if (
    targetRole !== "none" &&
    candidateRole !== "none" &&
    targetRole !== candidateRole
  ) {
    return {
      ok: false,
      message: `Cannot merge named Nets with incompatible power roles: ${targetRole}, ${candidateRole}`,
      relatedNetIds: [target.id, candidate.id],
    };
  }
  return {
    ok: true,
    netId: target.id,
    name: target.name!,
    edits: [
      {
        kind: "merge_nets",
        targetNetId: target.id,
        sourceNetId: candidate.id,
      },
    ],
  };
}
