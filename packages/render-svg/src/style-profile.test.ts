import { describe, expect, it } from "vitest";

import {
  razaviTextbookProfile,
  resolvePrimitiveStrokeWidth,
  resolveSchematicStyleProfile,
  strokeWidthForRole,
  textbookMonochromeProfile,
} from "./style-profile.js";

describe("schematic style profiles", () => {
  it("resolves immutable legacy and Razavi tokens", () => {
    expect(resolveSchematicStyleProfile("textbook-monochrome-v1")).toBe(
      textbookMonochromeProfile,
    );
    expect(resolveSchematicStyleProfile("razavi-textbook-v1")).toBe(
      razaviTextbookProfile,
    );
    expect(strokeWidthForRole(razaviTextbookProfile, "normal")).toBe(1.6);
    expect(strokeWidthForRole(razaviTextbookProfile, "emphasis")).toBe(2.4);
    expect(strokeWidthForRole(razaviTextbookProfile, "ground")).toBe(2.906977);
    expect(razaviTextbookProfile.nodes).toEqual({
      junctionRadius: 3.77907,
      portOriginRadius: 2.47907,
    });
    expect(razaviTextbookProfile.annotations).toEqual({
      supplyBarWidth: 20,
      currentArrowLength: 53.488372,
      arrowHeadLength: 16.569767,
      arrowHeadWidth: 7.906977,
      currentLabelGap: 6.976744,
      polarityOffsetX: 12,
      polarityHalfGap: 8,
    });
    expect(
      resolvePrimitiveStrokeWidth(razaviTextbookProfile, undefined, 2),
    ).toBe(2.4);
    expect(
      resolvePrimitiveStrokeWidth(textbookMonochromeProfile, undefined, 2),
    ).toBe(2);
  });

  it("rejects an unknown persisted profile instead of silently substituting", () => {
    expect(() => resolveSchematicStyleProfile("unknown-profile")).toThrow(
      "Unknown schematic style profile",
    );
  });
});
