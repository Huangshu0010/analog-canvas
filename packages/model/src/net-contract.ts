import type { SchematicDocument } from "./schema.js";

/**
 * The sole comparison key for authored Net names. The authored spelling stays
 * on `Net.name`; the folded key is derived-only and is never persisted.
 */
export function foldNetName(name: string): string {
  return name.trim().toLowerCase();
}

export interface NetContractIssue {
  code: "DUPLICATE_NET_NAME";
  foldedName: string;
  netIds: readonly string[];
}

/**
 * Validate the Document-local name invariant without changing its persisted
 * shape. Further Net-contract checks grow here so ERC and export can consume
 * the same facts rather than reimplementing name rules.
 */
export function validateNetContract(
  document: SchematicDocument,
): readonly NetContractIssue[] {
  const netIdsByFoldedName = new Map<string, string[]>();
  for (const net of document.nets) {
    if (!net.name) continue;
    const foldedName = foldNetName(net.name);
    const ids = netIdsByFoldedName.get(foldedName) ?? [];
    ids.push(net.id);
    netIdsByFoldedName.set(foldedName, ids);
  }

  return [...netIdsByFoldedName]
    .filter(([, netIds]) => netIds.length > 1)
    .map(([foldedName, netIds]) => ({
      code: "DUPLICATE_NET_NAME" as const,
      foldedName,
      netIds: [...netIds].sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    }))
    .sort((left, right) =>
      left.foldedName.localeCompare(right.foldedName, "en"),
    );
}

/** Stable key for comparing a contract issue before and after a transaction. */
export function netContractIssueKey(issue: NetContractIssue): string {
  return `${issue.code}:${issue.foldedName}:${issue.netIds.join(",")}`;
}
