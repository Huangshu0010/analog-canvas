import { describe, expect, it } from "vitest";

import { flattenMarkup, parseMarkup } from "./markup-parser.js";

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

  it("parses a line break", () => {
    const doc = parseMarkup("line1\\\\line2");
    expect(doc.runs[1]).toEqual({ kind: "line-break" });
  });

  it("preserves unparseable input as literal text, never dropping it", () => {
    const doc = parseMarkup("x^{unclosed + \\unknown");
    expect(flattenMarkup(doc)).toBe("x^{unclosed + \\unknown");
  });

  it("flattens a parsed document back to its literal text", () => {
    const doc = parseMarkup("M_{1} = \\frac{g_m}{r_o}");
    expect(flattenMarkup(doc)).toBe("M1 = g_m/r_o");
  });
});
