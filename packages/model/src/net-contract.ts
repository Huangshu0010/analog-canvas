import type { SchematicDocument } from "./schema.js";

/**
 * The sole comparison key for authored Net names. The authored spelling stays
 * on `Net.name`; the folded key is derived-only and is never persisted.
 */
export function foldNetName(name: string): string {
  return name.trim().toLowerCase();
}

export type NetContractIssue =
  | {
      code: "DUPLICATE_NET_NAME";
      foldedName: string;
      netIds: readonly string[];
    }
  | {
      code: "UNNAMED_GLOBAL_NET";
      netIds: readonly string[];
    };

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

  const duplicateNames = [...netIdsByFoldedName]
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
  const unnamedGlobals = document.nets
    .filter((net) => net.scope === "global" && !net.name)
    .map((net) => ({
      code: "UNNAMED_GLOBAL_NET" as const,
      netIds: [net.id],
    }));
  const issues: NetContractIssue[] = [...duplicateNames, ...unnamedGlobals];
  return issues.sort((left, right) =>
    `${left.code}:${left.code === "DUPLICATE_NET_NAME" ? left.foldedName : ""}:${left.netIds.join(",")}`.localeCompare(
      `${right.code}:${right.code === "DUPLICATE_NET_NAME" ? right.foldedName : ""}:${right.netIds.join(",")}`,
      "en",
    ),
  );
}

/** Stable key for comparing a contract issue before and after a transaction. */
export function netContractIssueKey(issue: NetContractIssue): string {
  return `${issue.code}:${issue.code === "DUPLICATE_NET_NAME" ? issue.foldedName : ""}:${issue.netIds.join(",")}`;
}
