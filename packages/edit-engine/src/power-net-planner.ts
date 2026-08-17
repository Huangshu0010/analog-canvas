import {
  foldNetName,
  type PowerDomain,
  type SchematicDocument,
} from "@icm/model";

import type { SchematicEdit } from "./edit-schema.js";

export type PowerNetCandidateState =
  "existing" | "pending-connection" | "created-power";

export interface EnsurePowerNetRequest {
  /** The caller-owned Net ID, existing now or created earlier in this transaction. */
  candidateNetId: string;
  candidateState: PowerNetCandidateState;
  domain: PowerDomain;
}

export type EnsurePowerNetPlan =
  | {
      ok: true;
      netId: string;
      edits: readonly SchematicEdit[];
    }
  | {
      ok: false;
      message: string;
      relatedNetIds: readonly string[];
    };

export function canonicalPowerName(domain: PowerDomain): "0" | "VDD" {
  return domain === "ground" ? "0" : "VDD";
}

/**
 * Preferred legacy IDs make repaired documents stable, but name + scope remain
 * the electrical identity. Callers must never select a supply by role alone.
 */
export function preferredPowerNetId(domain: PowerDomain): string {
  return domain === "ground" ? "net-global-0" : "net-global-vdd";
}

function powerDomainConflict(
  domain: PowerDomain,
  current: "none" | "vdd" | "ground" | "conflict",
): boolean {
  return current !== "none" && current !== domain;
}

function sortedCanonicalCandidates(
  document: SchematicDocument,
  domain: PowerDomain,
): readonly SchematicDocument["nets"][number][] {
  const name = canonicalPowerName(domain);
  const preferredId = preferredPowerNetId(domain);
  return document.nets
    .filter((net) => net.name && foldNetName(net.name) === foldNetName(name))
    .sort(
      (left, right) =>
        Number(right.id === preferredId) - Number(left.id === preferredId) ||
        Number(right.scope === "global") - Number(left.scope === "global") ||
        left.id.localeCompare(right.id, "en"),
    );
}

/**
 * Plans canonical supply reuse/merge without introducing a second mutation
 * protocol. A caller first creates or contacts `candidateNetId` with the
 * existing typed edits, then appends this plan's edits to the same transaction.
 */
export function planEnsurePowerNet(
  document: SchematicDocument,
  request: EnsurePowerNetRequest,
): EnsurePowerNetPlan {
  const candidate = document.nets.find(
    (net) => net.id === request.candidateNetId,
  );
  if (request.candidateState === "existing" && !candidate) {
    return {
      ok: false,
      message: `Power Net candidate does not exist: ${request.candidateNetId}`,
      relatedNetIds: [request.candidateNetId],
    };
  }

  const desiredName = canonicalPowerName(request.domain);
  const nameMatches = sortedCanonicalCandidates(document, request.domain);
  const conflictingNameNet = nameMatches.find((net) =>
    powerDomainConflict(request.domain, net.powerDomain ?? "none"),
  );
  if (conflictingNameNet) {
    return {
      ok: false,
      message: `Named supply ${desiredName} has incompatible power role ${conflictingNameNet.powerDomain ?? "none"}`,
      relatedNetIds: [conflictingNameNet.id],
    };
  }
  if (
    candidate?.name &&
    foldNetName(candidate.name) !== foldNetName(desiredName)
  ) {
    return {
      ok: false,
      message: `Cannot attach ${desiredName} to differently named Net ${candidate.name}`,
      relatedNetIds: [candidate.id],
    };
  }
  if (
    candidate &&
    powerDomainConflict(request.domain, candidate.powerDomain ?? "none")
  ) {
    return {
      ok: false,
      message: `Cannot attach ${desiredName} to Net with incompatible power role ${candidate.powerDomain ?? "none"}`,
      relatedNetIds: [candidate.id],
    };
  }

  const target = nameMatches[0];
  if (target) {
    const edits: SchematicEdit[] = [];
    if (
      request.candidateState !== "created-power" &&
      request.candidateNetId !== target.id
    ) {
      edits.push({
        kind: "merge_nets",
        targetNetId: target.id,
        sourceNetId: request.candidateNetId,
      });
    }
    if ((target.powerDomain ?? "none") === "none") {
      edits.push({
        kind: "set_net_power_domain",
        netId: target.id,
        powerDomain: request.domain,
      });
    }
    return { ok: true, netId: target.id, edits };
  }

  if (request.candidateState === "existing") {
    const edits: SchematicEdit[] = [];
    if (!candidate!.name) {
      edits.push({
        kind: "set_net_name",
        netId: candidate!.id,
        name: desiredName,
      });
    }
    if ((candidate!.powerDomain ?? "none") === "none") {
      edits.push({
        kind: "set_net_power_domain",
        netId: candidate!.id,
        powerDomain: request.domain,
      });
    }
    return { ok: true, netId: candidate!.id, edits };
  }

  return {
    ok: true,
    netId: request.candidateNetId,
    edits:
      request.candidateState === "pending-connection"
        ? [
            {
              kind: "set_net_power_domain",
              netId: request.candidateNetId,
              powerDomain: request.domain,
            },
          ]
        : [],
  };
}

/**
 * Deterministically repairs legacy same-Cell canonical supply duplicates. It
 * deliberately leaves differently named supplies (AVDD/DVDD) and incompatible
 * role evidence untouched for the shared ERC/export diagnostic.
 */
export function planRepairPowerNetDuplicates(
  document: SchematicDocument,
): readonly SchematicEdit[] {
  const edits: SchematicEdit[] = [];
  for (const domain of ["ground", "vdd"] as const) {
    const candidates = sortedCanonicalCandidates(document, domain).filter(
      (net) => !powerDomainConflict(domain, net.powerDomain ?? "none"),
    );
    if (candidates.length < 2) continue;
    const target = candidates[0]!;
    for (const source of candidates.slice(1)) {
      edits.push({
        kind: "merge_nets",
        targetNetId: target.id,
        sourceNetId: source.id,
      });
    }
    if ((target.powerDomain ?? "none") === "none") {
      edits.push({
        kind: "set_net_power_domain",
        netId: target.id,
        powerDomain: domain,
      });
    }
  }
  return edits;
}
