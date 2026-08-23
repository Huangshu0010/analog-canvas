import { foldNetName } from "@icm/model";
import type { SchematicDocument } from "@icm/model";

export type LogicalNetConflictCode = "name-conflict" | "scope-conflict";

export interface ResolvedLogicalNet {
  /** Stable canonical Base-Net ID; derived groups are never persisted. */
  id: string;
  baseNetIds: readonly string[];
  name?: string;
  scope?: "local" | "global";
  evidenceIds: readonly string[];
  sourceNetIds: readonly string[];
  conflicts: readonly LogicalNetConflictCode[];
}

export interface ResolvedDocumentLogicalNets {
  groups: readonly ResolvedLogicalNet[];
  byId: ReadonlyMap<string, ResolvedLogicalNet>;
  byBaseNetId: ReadonlyMap<string, ResolvedLogicalNet>;
}

class DisjointSet {
  readonly parent = new Map<string, string>();

  constructor(ids: readonly string[]) {
    for (const id of ids) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    this.parent.set(second!, first!);
  }
}

function unionGroups(
  set: DisjointSet,
  groups: Iterable<readonly string[]>,
): void {
  for (const ids of groups) {
    const [first, ...rest] = ids;
    if (!first) continue;
    for (const id of rest) set.union(first, id);
  }
}

/**
 * Resolve Document-local logical identity from schema-22 evidence. Physical
 * Base Nets remain intact; this pure result is the only name/source folding
 * implementation used by editor and netlist consumers.
 */
export function resolveDocumentLogicalNets(
  document: SchematicDocument,
): ResolvedDocumentLogicalNets {
  const baseNetIds = document.nets
    .map((net) => net.id)
    .sort((left, right) => left.localeCompare(right, "en"));
  const set = new DisjointSet(baseNetIds);

  unionGroups(
    set,
    document.connectivityEvidence.flatMap((evidence) =>
      evidence.kind === "explicit-equivalence" ? [evidence.memberNetIds] : [],
    ),
  );

  const byScopedName = new Map<string, string[]>();
  for (const evidence of document.connectivityEvidence) {
    if (evidence.kind !== "name-claim") continue;
    const key = `${evidence.scope}\u0000${foldNetName(evidence.name)}`;
    const ids = byScopedName.get(key) ?? [];
    ids.push(evidence.netId);
    byScopedName.set(key, ids);
  }
  unionGroups(set, byScopedName.values());

  const bySource = new Map<string, string[]>();
  for (const evidence of document.connectivityEvidence) {
    if (evidence.kind !== "spice-source") continue;
    const ids = bySource.get(evidence.sourceNetId) ?? [];
    ids.push(evidence.netId);
    bySource.set(evidence.sourceNetId, ids);
  }
  unionGroups(set, bySource.values());

  // Transitional fallback: a schema-22 producer not yet migrated to evidence
  // still gets the legacy single-name behavior without overriding real claims.
  const claimedNetIds = new Set(
    document.connectivityEvidence.flatMap((evidence) =>
      evidence.kind === "name-claim" ? [evidence.netId] : [],
    ),
  );
  const byLegacyName = new Map<string, string[]>();
  for (const net of document.nets) {
    if (!net.name || claimedNetIds.has(net.id)) continue;
    const key = `${net.scope}\u0000${foldNetName(net.name)}`;
    const ids = byLegacyName.get(key) ?? [];
    ids.push(net.id);
    byLegacyName.set(key, ids);
  }
  unionGroups(set, byLegacyName.values());

  const membersByRoot = new Map<string, string[]>();
  for (const netId of baseNetIds) {
    const root = set.find(netId);
    const members = membersByRoot.get(root) ?? [];
    members.push(netId);
    membersByRoot.set(root, members);
  }

  const groups = [...membersByRoot.values()]
    .map((members): ResolvedLogicalNet => {
      members.sort((left, right) => left.localeCompare(right, "en"));
      const memberSet = new Set(members);
      const evidence = document.connectivityEvidence
        .filter((item) =>
          item.kind === "explicit-equivalence"
            ? item.memberNetIds.some((netId) => memberSet.has(netId))
            : memberSet.has(item.netId),
        )
        .sort((left, right) => left.id.localeCompare(right.id, "en"));
      const nameCandidates = evidence.flatMap((item) =>
        item.kind === "name-claim" ? [item.name] : [],
      );
      if (nameCandidates.length === 0) {
        for (const netId of members) {
          const name = document.nets.find((net) => net.id === netId)?.name;
          if (name) nameCandidates.push(name);
        }
      }
      const namesByFolded = new Map<string, string>();
      for (const name of nameCandidates) {
        const folded = foldNetName(name);
        if (!namesByFolded.has(folded)) namesByFolded.set(folded, name.trim());
      }
      const scopes = new Set(
        members.map(
          (netId) => document.nets.find((net) => net.id === netId)!.scope,
        ),
      );
      const conflicts: LogicalNetConflictCode[] = [];
      if (namesByFolded.size > 1) conflicts.push("name-conflict");
      if (scopes.size > 1) conflicts.push("scope-conflict");
      const sourceNetIds = [
        ...new Set(
          evidence.flatMap((item) =>
            item.kind === "spice-source" ? [item.sourceNetId] : [],
          ),
        ),
      ].sort((left, right) => left.localeCompare(right, "en"));
      return {
        id: members[0]!,
        baseNetIds: members,
        ...(namesByFolded.size === 1
          ? { name: [...namesByFolded.values()][0]! }
          : {}),
        ...(scopes.size === 1
          ? { scope: [...scopes][0] as "local" | "global" }
          : {}),
        evidenceIds: evidence.map((item) => item.id),
        sourceNetIds,
        conflicts,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  const byId = new Map(groups.map((group) => [group.id, group]));
  const byBaseNetId = new Map(
    groups.flatMap((group) =>
      group.baseNetIds.map((netId) => [netId, group] as const),
    ),
  );
  return { groups, byId, byBaseNetId };
}
