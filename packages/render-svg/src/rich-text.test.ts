import { describe, expect, it } from "vitest";

import { renderRichTextDocument } from "./rich-text.js";
import { razaviTextbookProfile } from "./style-profile.js";

describe("renderRichTextDocument (WP-A2)", () => {
  it("renders a plain text run escaped", () => {
    const svg = renderRichTextDocument(
      { runs: [{ kind: "text", value: "a<b>&c" }] },
      razaviTextbookProfile,
    );
    expect(svg).toBe("a&lt;b&gt;&amp;c");
  });

  it("renders italic and bold spans", () => {
    const svg = renderRichTextDocument(
      {
        runs: [
          {
            kind: "span",
            style: "italic",
            children: [{ kind: "text", value: "I" }],
          },
          {
            kind: "span",
            style: "bold",
            children: [{ kind: "text", value: "B" }],
          },
        ],
      },
      razaviTextbookProfile,
    );
    expect(svg).toContain('data-text-run="span"');
    expect(svg).toContain("font-style:italic");
    expect(svg).toContain("font-weight:700");
  });

  it("composes nested styles instead of letting an inner style erase its parent", () => {
    const svg = renderRichTextDocument(
      {
        runs: [
          {
            kind: "span",
            style: "italic",
            children: [
              {
                kind: "span",
                style: "bold",
                children: [{ kind: "text", value: "gm" }],
              },
            ],
          },
        ],
      },
      razaviTextbookProfile,
    );
    expect(svg).toContain(
      'style="font-style:italic;font-weight:700">gm</tspan>',
    );
    expect(svg).not.toContain('font-style:normal;font-weight:700">gm');
  });

  it("renders subscript and superscript with scaled size and baseline shift", () => {
    const svg = renderRichTextDocument(
      {
        runs: [
          { kind: "text", value: "V" },
          {
            kind: "span",
            style: "subscript",
            children: [{ kind: "text", value: "in" }],
          },
          {
            kind: "span",
            style: "superscript",
            children: [{ kind: "text", value: "+" }],
          },
        ],
      },
      razaviTextbookProfile,
    );
    expect(svg).toContain('data-text-run="subscript"');
    expect(svg).toContain('data-text-run="superscript"');
    // Authority-calibrated Arial subscript scale 0.76 -> 76%.
    expect(svg).toContain('font-size="76%"');
    expect(svg).toContain('baseline-shift="-0.2em"');
  });

  it("renders a fraction with numerator and denominator tspans", () => {
    const svg = renderRichTextDocument(
      {
        runs: [
          {
            kind: "fraction",
            numerator: { runs: [{ kind: "text", value: "g_m" }] },
            denominator: { runs: [{ kind: "text", value: "r_o" }] },
          },
        ],
      },
      razaviTextbookProfile,
    );
    expect(svg).toContain('data-text-run="fraction"');
    expect(svg).toContain('data-text-run="numerator"');
    expect(svg).toContain('data-text-run="denominator"');
    expect(svg).toContain("g_m");
    expect(svg).toContain("r_o");
  });

  it("renders a line break", () => {
    const svg = renderRichTextDocument(
      {
        runs: [
          { kind: "text", value: "line1" },
          { kind: "line-break" },
          { kind: "text", value: "line2" },
        ],
      },
      razaviTextbookProfile,
      { lineOriginX: 240 },
    );
    expect(svg).toContain('data-text-run="line-break"');
    expect(svg).toContain('x="240"');
    expect(svg).not.toContain('x="0"');
    expect(svg).toContain('dy="1em">line2</tspan>');
  });
});
