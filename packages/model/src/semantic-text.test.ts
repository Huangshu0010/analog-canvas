import { describe, expect, it } from "vitest";

import { flattenRichText } from "./rich-text.js";
import { semanticTextDocument } from "./semantic-text.js";

describe("semantic formal-Port text", () => {
  it("derives a Razavi voltage base and subscript from the electrical name", () => {
    const content = semanticTextDocument("Vout", "formal-port");

    expect(flattenRichText(content)).toBe("Vout");
    expect(content).toMatchObject({
      runs: [
        { kind: "span", style: "italic", children: [{ kind: "span" }] },
        { kind: "span", style: "subscript", children: [{ kind: "span" }] },
      ],
    });
    expect(content.runs[0]).toMatchObject({
      children: [{ children: [{ value: "V" }] }],
    });
    expect(content.runs[1]).toMatchObject({
      children: [{ children: [{ value: "out" }] }],
    });
  });
});
