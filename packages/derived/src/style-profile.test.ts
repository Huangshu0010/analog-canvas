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

  it("uses the authority-calibrated compact Arial text metrics", () => {
    expect(globalSchematicTypography).toMatchObject({
      fontFamily: "Arial,'Helvetica Neue',Helvetica,sans-serif",
      instanceFontSize: 17.44186,
      subscriptScale: 0.76,
      subscriptBaselineShiftEm: 0.2,
    });
  });
});
