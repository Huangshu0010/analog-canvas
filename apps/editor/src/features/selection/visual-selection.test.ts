import { describe, expect, it } from "vitest";

import {
  EMPTY_VISUAL_SELECTION,
  clearVisualSelectionKinds,
  hasVisualSelection,
  normalizeVisualSelection,
  replaceVisualSelectionKind,
} from "./visual-selection";

describe("VisualSelection", () => {
  it("normalizes each visual object kind independently", () => {
    expect(
      normalizeVisualSelection({
        instanceIds: ["M1", "M1"],
        routeIds: ["r1", "r1"],
        junctionIds: ["j1"],
        annotationIds: ["a1", "a1"],
        draftingIds: ["note-1"],
      }),
    ).toEqual({
      instanceIds: ["M1"],
      routeIds: ["r1"],
      junctionIds: ["j1"],
      annotationIds: ["a1"],
      draftingIds: ["note-1"],
    });
  });

  it("replaces and clears only the requested object kinds", () => {
    const selected = replaceVisualSelectionKind(
      {
        ...EMPTY_VISUAL_SELECTION,
        instanceIds: ["M1"],
        annotationIds: ["label-M1"],
      },
      "route",
      ["r1", "r1"],
    );
    expect(selected).toEqual({
      instanceIds: ["M1"],
      routeIds: ["r1"],
      junctionIds: [],
      annotationIds: ["label-M1"],
      draftingIds: [],
    });
    expect(
      clearVisualSelectionKinds(selected, ["route", "annotation"]),
    ).toEqual({ ...EMPTY_VISUAL_SELECTION, instanceIds: ["M1"] });
    expect(hasVisualSelection(EMPTY_VISUAL_SELECTION)).toBe(false);
    expect(hasVisualSelection(selected)).toBe(true);
  });
});
