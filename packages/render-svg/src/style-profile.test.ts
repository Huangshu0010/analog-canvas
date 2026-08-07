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
    expect(razaviTextbookProfile.nodes).toEqual({
      junctionRadius: 3,
      portOriginRadius: 3,
    });
    expect(razaviTextbookProfile.annotations).toEqual({
      supplyBarWidth: 20,
      currentArrowLength: 24,
      arrowHeadLength: 10,
      arrowHeadWidth: 7,
      currentLabelGap: 7,
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
