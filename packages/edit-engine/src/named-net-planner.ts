import { foldNetName } from "@icm/model";
import type { ConnectivityEvidence } from "@icm/model";

import type { SchematicEdit } from "./edit-schema.js";

type NameClaim = Extract<ConnectivityEvidence, { kind: "name-claim" }>;

export type EnsureNamedNetPlan =
  | { ok: true; netId: string; name: string; edits: readonly SchematicEdit[] }
  | { ok: false; message: string; relatedNetIds: readonly string[] };

export interface NamedNetPlannerDocument {
  nets: readonly {
    id: string;
    name?: string | undefined;
    scope: "local" | "global";
    powerDomain?: "none" | "vdd" | "ground" | "conflict" | undefined;
  }[];
  connectivityEvidence: readonly ConnectivityEvidence[];
}

/** Author an owner-addressed name without merging physical Base Nets. */
export function planEnsureNamedNet(
  document: NamedNetPlannerDocument,
  request: {
    candidateNetId: string;
    name: string;
    evidenceId: string;
    owner: NameClaim["owner"];
  },
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
  if (!name) {
    return {
      ok: false,
      message: "Named Net claim cannot be empty",
      relatedNetIds: [candidate.id],
    };
  }
  const foldedName = foldNetName(name);
  const matchingNetIds = new Set(
    document.connectivityEvidence.flatMap((evidence) =>
      evidence.kind === "name-claim" &&
      evidence.scope === candidate.scope &&
      foldNetName(evidence.name) === foldedName
        ? [evidence.netId]
        : [],
    ),
  );
  for (const net of document.nets) {
    if (net.name && foldNetName(net.name) === foldedName) {
      matchingNetIds.add(net.id);
    }
  }
  const incompatible = [...matchingNetIds]
    .map((netId) => document.nets.find((net) => net.id === netId))
    .find(
      (net) =>
        net &&
        (net.powerDomain ?? "none") !== "none" &&
        (candidate.powerDomain ?? "none") !== "none" &&
        net.powerDomain !== candidate.powerDomain,
    );
  if (incompatible) {
    return {
      ok: false,
      message: `Cannot join named Nets with incompatible power roles: ${incompatible.powerDomain ?? "none"}, ${candidate.powerDomain ?? "none"}`,
      relatedNetIds: [incompatible.id, candidate.id],
    };
  }

  const evidence: NameClaim = {
    id: request.evidenceId,
    kind: "name-claim",
    netId: candidate.id,
    name,
    owner: request.owner,
    scope: candidate.scope,
  };
  const existingEvidence = document.connectivityEvidence.find(
    (item) => item.id === evidence.id,
  );
  const edits: SchematicEdit[] = [];
  // A legacy/imported Net name is represented by an explicit-property claim.
  // Editing a visible owner adopts that existing name source; leaving the old
  // explicit claim untouched would manufacture a conflict from one historical
  // name. Other label/Port owners remain independent and can still conflict.
  for (const item of document.connectivityEvidence) {
    if (
      item.id !== evidence.id &&
      item.kind === "name-claim" &&
      item.netId === candidate.id &&
      item.owner.kind === "explicit-net-property" &&
      item.name !== name
    ) {
      edits.push({
        kind: "upsert_connectivity_evidence",
        evidence: { ...item, name },
      });
    }
  }
  if (JSON.stringify(existingEvidence) !== JSON.stringify(evidence)) {
    edits.push({ kind: "upsert_connectivity_evidence", evidence });
  }
  return { ok: true, netId: candidate.id, name, edits };
}
