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

  it("uses the same explicit multi-character subscript grammar for Ports and Net Labels", () => {
    const port = semanticTextDocument("V_{in,cm}", "formal-port");
    const net = semanticTextDocument("V_{in,cm}", "net-label");

    expect(port).toEqual(net);
    expect(flattenRichText(port)).toBe("Vin,cm");
    expect(port.runs[1]).toMatchObject({
      kind: "span",
      style: "subscript",
      children: [{ children: [{ value: "in,cm" }] }],
    });
  });
});
