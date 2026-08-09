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
});
