import type { HierarchyFrame } from "./object-locator.js";
import type { ProjectConnectivityIndex } from "./connectivity-index.js";

/**
 * Find a deterministic concrete instance path through the imported hierarchy.
 * Multiple instances may reference the same child Cell, so this returns frames
 * rather than a lossy list of document ids. Breadth-first search selects the
 * shortest path and the stable edge order makes ties repeatable.
 */
export function findHierarchyPath(
  index: ProjectConnectivityIndex,
  rootDocumentId: string,
  targetDocumentId: string,
): readonly HierarchyFrame[] | undefined {
  if (rootDocumentId === targetDocumentId) return [];
  const edges = [...index.hierarchy.edges]
    .sort(
      (left, right) =>
        left.parentDocumentId.localeCompare(right.parentDocumentId, "en") ||
        left.instanceId.localeCompare(right.instanceId, "en") ||
        left.childDocumentId.localeCompare(right.childDocumentId, "en") ||
        left.parentPinName.localeCompare(right.parentPinName, "en"),
    )
    .map((edge): HierarchyFrame => ({
      parentDocumentId: edge.parentDocumentId,
      instanceId: edge.instanceId,
      childDocumentId: edge.childDocumentId,
    }));
  const byParent = new Map<string, HierarchyFrame[]>();
  for (const frame of edges) {
    const frames = byParent.get(frame.parentDocumentId) ?? [];
    if (
      !frames.some(
        (candidate) =>
          candidate.instanceId === frame.instanceId &&
          candidate.childDocumentId === frame.childDocumentId,
      )
    ) {
      frames.push(frame);
    }
    byParent.set(frame.parentDocumentId, frames);
  }

  const queue: Array<{ documentId: string; path: readonly HierarchyFrame[] }> =
    [{ documentId: rootDocumentId, path: [] }];
  const visited = new Set<string>([rootDocumentId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const frame of byParent.get(current.documentId) ?? []) {
      if (visited.has(frame.childDocumentId)) continue;
      const path = [...current.path, frame];
      if (frame.childDocumentId === targetDocumentId) return path;
      visited.add(frame.childDocumentId);
      queue.push({ documentId: frame.childDocumentId, path });
    }
  }
  return undefined;
}
