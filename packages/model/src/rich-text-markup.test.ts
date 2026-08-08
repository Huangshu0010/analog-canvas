import { describe, expect, it } from "vitest";

import {
  flattenRichText,
  normalizeRichText,
  parseMarkup,
  serializeMarkup,
} from "./rich-text-markup.js";
import type { MarkupDocument } from "./rich-text-markup.js";

describe("parseMarkup (ADR 0010 import shorthand)", () => {
  it("parses a plain string as a single text run", () => {
    expect(parseMarkup("Design note")).toEqual({
      runs: [{ kind: "text", value: "Design note" }],
    });
  });

  it("parses a subscript into a span", () => {
    const doc = parseMarkup("M_{1}");
    expect(doc).toEqual({
      runs: [
        { kind: "text", value: "M" },
        {
          kind: "span",
          style: "subscript",
          children: [{ kind: "text", value: "1" }],
        },
      ],
    });
  });

  it("parses a superscript into a span", () => {
    const doc = parseMarkup("V_{in}^{+}");
    const subscript = doc.runs.find(
      (run) => run.kind === "span" && run.style === "subscript",
    );
    const superscript = doc.runs.find(
      (run) => run.kind === "span" && run.style === "superscript",
    );
    expect(subscript?.children).toEqual([{ kind: "text", value: "in" }]);
    expect(superscript?.children).toEqual([{ kind: "text", value: "+" }]);
  });

  it("parses italic and bold spans", () => {
    const doc = parseMarkup("\\it{I_x} and \\bf{out}");
    expect(doc.runs[0]).toMatchObject({
      kind: "span",
      style: "italic",
      children: [{ kind: "text", value: "I_x" }],
    });
    expect(doc.runs[2]).toMatchObject({ kind: "span", style: "bold" });
  });

  it("parses a fraction with nested runs", () => {
    const doc = parseMarkup("\\frac{g_m}{r_o}");
    expect(doc).toEqual({
      runs: [
        {
          kind: "fraction",
          numerator: { runs: [{ kind: "text", value: "g_m" }] },
          denominator: { runs: [{ kind: "text", value: "r_o" }] },
        },
      ],
    });
  });

  it("parses a line break from backslash-n", () => {
    const doc = parseMarkup("line1\\nline2");
    expect(doc.runs[1]).toEqual({ kind: "line-break" });
  });

  it("preserves unknown backslash sequences and unclosed commands as literal text", () => {
    const doc = parseMarkup("x^{unclosed + \\unknown");
    expect(flattenRichText(doc)).toBe("x^{unclosed + \\unknown");
    expect(flattenRichText(parseMarkup("\\Omega"))).toBe("\\Omega");
  });

  it("flattens a parsed document back to its literal text", () => {
    const doc = parseMarkup("M_{1} = \\frac{g_m}{r_o}");
    expect(flattenRichText(doc)).toBe("M1 = g_m/r_o");
  });

  it("parses a fraction whose parameters contain nested subscripts", () => {
    const doc = parseMarkup("\\frac{V_{DD}}{2}");
    expect(doc).toEqual({
      runs: [
        {
          kind: "fraction",
          numerator: {
            runs: [
              { kind: "text", value: "V" },
              {
                kind: "span",
                style: "subscript",
                children: [{ kind: "text", value: "DD" }],
              },
            ],
          },
          denominator: { runs: [{ kind: "text", value: "2" }] },
        },
      ],
    });
  });

  it("round-trips parseMarkup(serializeMarkup(ast)) for every required scenario", () => {
    const scenarios = [
      "V_{in}^{+}",
      "\\frac{V_{DD}}{2}",
      "\\it{gain}",
      "\\bf{RESET}",
      "line1\\nline2",
      "\\it{V_{in}}",
      "\\it{}",
      "a\\it{b}c",
      "V_{in} 中文",
    ];
    for (const input of scenarios) {
      const ast = parseMarkup(input);
      expect(parseMarkup(serializeMarkup(ast))).toEqual(ast);
    }
  });

  it("round-trips ANY valid AST, including literal markup-like text (P0-1)", () => {
    const cases: MarkupDocument[] = [
      { runs: [{ kind: "text", value: "V_{in}" }] },
      { runs: [{ kind: "text", value: "\\frac{1}{2}" }] },
      { runs: [{ kind: "text", value: "a\\b{c}" }] },
      {
        runs: [
          { kind: "text", value: "x" },
          { kind: "line-break" },
          { kind: "text", value: "y_{z}^{w}" },
        ],
      },
      {
        runs: [
          {
            kind: "fraction",
            numerator: { runs: [{ kind: "text", value: "V_{DD}" }] },
            denominator: { runs: [{ kind: "text", value: "2" }] },
          },
        ],
      },
      {
        runs: [
          {
            kind: "span",
            style: "italic",
            children: [{ kind: "text", value: "a_{b}" }],
          },
        ],
      },
    ];
    for (const ast of cases) {
      const serialized = serializeMarkup(ast);
      const back = parseMarkup(serialized);
      // parseMarkup may coalesce a literal; use normalization for equality.
      expect(normalizeRichText(back)).toEqual(normalizeRichText(ast));
    }
  });

  it("normalizes adjacent text runs and drops empty ones", () => {
    const doc = parseMarkup("a\\it{b}c");
    expect(normalizeRichText(doc)).toEqual({
      runs: [
        { kind: "text", value: "a" },
        {
          kind: "span",
          style: "italic",
          children: [{ kind: "text", value: "b" }],
        },
        { kind: "text", value: "c" },
      ],
    });
  });
});
