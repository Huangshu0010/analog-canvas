import { describe, expect, it } from "vitest";

import {
  parseSchematicMath,
  renderSchematicTextContent,
  schematicTextDocument,
  schematicTextFontSize,
} from "./schematic-text.js";
import { renderRichTextDocument } from "./rich-text.js";
import type { RichTextDocumentInput } from "./rich-text.js";
import {
  razaviTextbookProfile,
  textbookMonochromeProfile,
} from "./style-profile.js";

describe("Razavi schematic typography", () => {
  it.each([
    ["M1", "instance-label", { base: "M", subscript: "1", style: "math" }],
    ["R1", "instance-label", { base: "R", subscript: "1", style: "math" }],
    ["VDD", "power-label", { base: "V", subscript: "DD", style: "math" }],
    ["Vb1", "net-label", { base: "V", subscript: "b1", style: "math" }],
    ["IX", "route-marker", { base: "I", subscript: "X", style: "math" }],
    ["V_X", "route-marker", { base: "V", subscript: "X", style: "math" }],
    [
      "VIN+",
      "net-label",
      { base: "V", subscript: "IN", suffix: "+", style: "math" },
    ],
    [
      "VIN-",
      "net-label",
      { base: "V", subscript: "IN", suffix: "-", style: "math" },
    ],
    [
      "XM12",
      "default-instance",
      { base: "XM", subscript: "12", style: "math" },
    ],
  ] as const)("parses %s by %s semantics", (text, kind, expected) => {
    expect(parseSchematicMath(text, kind)).toEqual(expected);
  });

  it("does not implicitly parse bare signs or numeric values", () => {
    expect(parseSchematicMath("+", "route-marker")).toBeNull();
    expect(parseSchematicMath("1.2 V", "route-marker")).toBeNull();
  });

  it("escapes text and emits deterministic Razavi tspan runs", () => {
    const explicit = renderSchematicTextContent(
      "V_<X&Y>",
      "net-label",
      razaviTextbookProfile,
    );
    expect(explicit).toContain("font-style:italic;font-weight:700");
    expect(explicit).toContain('data-text-run="subscript"');
    expect(explicit).toContain("&lt;X&amp;Y&gt;");
    const signed = renderSchematicTextContent(
      "VIN+",
      "net-label",
      razaviTextbookProfile,
    );
    expect(signed).toContain('data-text-run="subscript"');
    expect(signed).toContain("IN");
    expect(signed).toContain('data-text-run="suffix"');
    expect(signed).toContain(
      'style="font-style:normal;font-weight:400">+</tspan>',
    );
    expect(
      renderSchematicTextContent(
        "M1",
        "instance-label",
        textbookMonochromeProfile,
      ),
    ).toBe("M1");
  });

  it("uses semantic profile sizes", () => {
    expect(schematicTextFontSize("instance-label", razaviTextbookProfile)).toBe(
      18,
    );
    expect(schematicTextFontSize("route-marker", razaviTextbookProfile)).toBe(
      18,
    );
  });

  it("uses upright bold semantic subscripts with calibrated geometry", () => {
    const rendered = renderSchematicTextContent(
      "VDD",
      "power-label",
      razaviTextbookProfile,
    );
    expect(rendered).toContain('font-size="84%"');
    expect(rendered).toContain('baseline-shift="-0.28em"');
    expect(rendered).toContain("font-style:italic;font-weight:700");
    expect(rendered).toContain("font-style:normal;font-weight:700");
  });

  it("uses the same base/subscript convention in editor RichText defaults", () => {
    const rendered = renderRichTextDocument(
      schematicTextDocument(
        "M1",
        "instance-label",
      ) as unknown as RichTextDocumentInput,
      // The renderer's input admits compatibility-role metadata while the
      // persisted model intentionally keeps its run union opaque here.
      // The generated document itself remains model-valid.
      razaviTextbookProfile,
    );
    expect(rendered).toContain("font-style:italic;font-weight:700");
    expect(rendered).toContain("font-style:normal;font-weight:700");
  });
});
