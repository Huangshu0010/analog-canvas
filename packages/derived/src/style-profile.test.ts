import { describe, expect, it } from "vitest";

import {
  globalSchematicTypography,
  razaviTextbookProfile,
  textbookMonochromeProfile,
} from "./style-profile.js";

describe("schematic style profiles", () => {
  it("shares one calibrated typography system across every profile", () => {
    expect(textbookMonochromeProfile.typography).toBe(
      globalSchematicTypography,
    );
    expect(razaviTextbookProfile.typography).toBe(globalSchematicTypography);
  });

  it("uses the authority-calibrated Razavi text metrics", () => {
    expect(globalSchematicTypography).toMatchObject({
      fontFamily: "'DejaVu Sans',Arial,'Helvetica Neue',Helvetica,sans-serif",
      instanceFontSize: 15.116,
      subscriptScale: 0.76,
      subscriptBaselineShiftEm: 0.28,
      subscriptHorizontalGapEm: 0.046,
    });
  });
});
