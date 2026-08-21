import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  normalizedStyleOverrides,
  StyleDialog,
  styleOverrideDraft,
  STYLE_KNOBS,
} from "./style-dialog";

describe("style override draft normalization", () => {
  it("round-trips persisted overrides through the draft shape", () => {
    const draft = styleOverrideDraft({ fontScale: 1.5, wireStrokeScale: 0.75 });
    expect(draft).toEqual({
      fontScale: 1.5,
      wireStrokeScale: 0.75,
      symbolStrokeScale: 1,
      annotationStrokeScale: 1,
      junctionRadiusScale: 1,
    });
    expect(normalizedStyleOverrides(draft)).toEqual({
      fontScale: 1.5,
      wireStrokeScale: 0.75,
    });
  });

  it("collapses an all-default draft to null so the edit clears", () => {
    expect(normalizedStyleOverrides(styleOverrideDraft(undefined))).toBeNull();
  });
});

describe("StyleDialog", () => {
  it("renders every knob with its persisted value and a working reset", () => {
    const markup = renderToStaticMarkup(
      createElement(StyleDialog, {
        overrides: { fontScale: 1.5 },
        onApply: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(markup).toContain('data-testid="document-style-dialog"');
    for (const knob of STYLE_KNOBS) {
      expect(markup).toContain(`aria-label="${knob.label}"`);
    }
    expect(markup).toContain('<option value="1.5" selected="">1.5×</option>');
    expect(markup).toContain("Reset all to profile defaults");
    // With overrides present the reset button is enabled.
    expect(markup).not.toContain('disabled="">Reset all to profile defaults');
  });

  it("disables reset when the document already uses profile defaults", () => {
    const markup = renderToStaticMarkup(
      createElement(StyleDialog, {
        overrides: undefined,
        onApply: () => undefined,
        onClose: () => undefined,
      }),
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain(">Default (1×)</option>");
  });
});
