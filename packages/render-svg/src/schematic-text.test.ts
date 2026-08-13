import { describe, expect, it } from "vitest";
import { semanticTextDocument } from "@icm/model";

import { schematicTextFontSize } from "./schematic-text.js";
import { renderRichTextDocument } from "./rich-text.js";
import { razaviTextbookProfile } from "@icm/derived";

describe("Razavi schematic typography", () => {
  it("renders only the RichText AST supplied by its caller", () => {
    const rendered = renderRichTextDocument(
      semanticTextDocument("VDD", "power-label"),
      razaviTextbookProfile,
    );
    expect(rendered).toContain('data-text-run="subscript"');
    expect(rendered).toContain('font-size="76%"');
    expect(rendered).toContain('baseline-shift="-0.28em"');
    expect(rendered).toContain('dx="0.046em"');
    expect(rendered).toContain("font-style:italic;font-weight:700");
    expect(rendered).toContain("font-style:normal;font-weight:700");
  });

  it("uses semantic profile sizes", () => {
    expect(schematicTextFontSize("instance-label", razaviTextbookProfile)).toBe(
      15.116,
    );
    expect(schematicTextFontSize("route-marker", razaviTextbookProfile)).toBe(
      15.116,
    );
  });
});
