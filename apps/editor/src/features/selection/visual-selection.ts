export type VisualSelectionKind =
  "instance" | "route" | "junction" | "annotation" | "drafting";

export interface VisualSelection {
  instanceIds: string[];
  routeIds: string[];
  junctionIds: string[];
  annotationIds: string[];
  draftingIds: string[];
}

export const EMPTY_VISUAL_SELECTION: VisualSelection = {
  instanceIds: [],
  routeIds: [],
  junctionIds: [],
  annotationIds: [],
  draftingIds: [],
};

const propertyByKind: Record<VisualSelectionKind, keyof VisualSelection> = {
  instance: "instanceIds",
  route: "routeIds",
  junction: "junctionIds",
  annotation: "annotationIds",
  drafting: "draftingIds",
};

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * The editor-only common selection contract. It intentionally contains IDs,
 * not persisted objects: model schemas keep their own semantic responsibilities.
 */
export function normalizeVisualSelection(
  selection: VisualSelection,
): VisualSelection {
  return {
    instanceIds: unique(selection.instanceIds),
    routeIds: unique(selection.routeIds),
    junctionIds: unique(selection.junctionIds),
    annotationIds: unique(selection.annotationIds),
    draftingIds: unique(selection.draftingIds),
  };
}

export function replaceVisualSelectionKind(
  selection: VisualSelection,
  kind: VisualSelectionKind,
  ids: readonly string[],
): VisualSelection {
  return normalizeVisualSelection({
    ...selection,
    [propertyByKind[kind]]: [...ids],
  });
}

export function clearVisualSelectionKinds(
  selection: VisualSelection,
  kinds: readonly VisualSelectionKind[],
): VisualSelection {
  let next = selection;
  for (const kind of kinds) {
    next = replaceVisualSelectionKind(next, kind, []);
  }
  return next;
}

export function hasVisualSelection(selection: VisualSelection): boolean {
  return Object.values(selection).some((ids) => ids.length > 0);
}
