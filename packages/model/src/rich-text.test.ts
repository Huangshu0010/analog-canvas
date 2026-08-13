import { describe, expect, it } from "vitest";

import { flattenRichText, normalizeRichText } from "./rich-text.js";
import { RichTextDocumentSchema } from "./schema.js";
import type { RichTextDocument } from "./schema.js";

describe("canonical RichText helpers", () => {
  it("normalizes nested spans and flattens retained formatting", () => {
    const content: RichTextDocument = {
      runs: [
        { kind: "text", value: "V" },
        { kind: "text", value: "" },
        {
          kind: "span",
          style: "subscript",
          children: [
            { kind: "text", value: "D" },
            { kind: "text", value: "D" },
          ],
        },
        { kind: "line-break" },
        {
          kind: "span",
          style: "superscript",
          children: [{ kind: "text", value: "+" }],
        },
      ],
    };

    const normalized = normalizeRichText(content);
    expect(normalized.runs[1]).toEqual({
      kind: "span",
      style: "subscript",
      children: [{ kind: "text", value: "DD" }],
    });
    expect(flattenRichText(normalized)).toBe("VDD\n+");
    expect(RichTextDocumentSchema.safeParse(normalized).success).toBe(true);
  });

  it("rejects the retired fraction node", () => {
    expect(
      RichTextDocumentSchema.safeParse({
        runs: [
          {
            kind: "fraction",
            numerator: { runs: [{ kind: "text", value: "1" }] },
            denominator: { runs: [{ kind: "text", value: "2" }] },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps former markup commands as literal text", () => {
    const content: RichTextDocument = {
      runs: [{ kind: "text", value: "V_{IN} = \\frac{1}{2}" }],
    };
    expect(flattenRichText(content)).toBe("V_{IN} = \\frac{1}{2}");
  });
});
