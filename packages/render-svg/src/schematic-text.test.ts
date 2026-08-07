import { describe, expect, it } from "vitest";

import {
  parseSchematicMath,
  renderSchematicTextContent,
  schematicTextFontSize,
} from "./schematic-text.js";
import {
  razaviTextbookProfile,
  textbookMonochromeProfile,
} from "./style-profile.js";

describe("Razavi schematic typography", () => {
  it.each([
    ["M1", "instance-label", { base: "M", subscript: "1" }],
    ["R1", "instance-label", { base: "R", subscript: "1" }],
    ["VDD", "power-label", { base: "V", subscript: "DD" }],
    ["Vb1", "net-label", { base: "V", subscript: "b1" }],
    ["IX", "current", { base: "I", subscript: "X" }],
    ["V_X", "voltage", { base: "V", subscript: "X" }],
    ["VIN+", "net-label", { base: "V", subscript: "IN", suffix: "+" }],
    ["VIN-", "net-label", { base: "V", subscript: "IN", suffix: "-" }],
    ["XM12", "default-instance", { base: "XM", subscript: "12" }],
  ] as const)("parses %s by %s semantics", (text, kind, expected) => {
    expect(parseSchematicMath(text, kind)).toEqual(expected);
  });

  it("does not implicitly parse notes, captions, signs, or numeric values", () => {
    expect(parseSchematicMath("VDD", "plain-text")).toBeNull();
    expect(parseSchematicMath("M1", "figure-caption")).toBeNull();
    expect(parseSchematicMath("+", "voltage")).toBeNull();
    expect(parseSchematicMath("1.2 V", "voltage")).toBeNull();
  });

  it("escapes text and emits deterministic Razavi tspan runs", () => {
    expect(
      renderSchematicTextContent("V_<X&Y>", "net-label", razaviTextbookProfile),
    ).toBe(
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">V</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">&lt;X&amp;Y&gt;</tspan>',
    );
    expect(
      renderSchematicTextContent("VIN+", "net-label", razaviTextbookProfile),
    ).toBe(
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">V</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">IN</tspan><tspan data-text-run="suffix" style="font-style:normal;font-weight:400">+</tspan>',
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
      16,
    );
    expect(schematicTextFontSize("figure-caption", razaviTextbookProfile)).toBe(
      14,
    );
  });
});
