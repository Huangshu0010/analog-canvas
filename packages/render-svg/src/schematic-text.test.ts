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
    ["XM12", "default-instance", { base: "XM", subscript: "12", style: "math" }],
  ] as const)("parses %s by %s semantics", (text, kind, expected) => {
    expect(parseSchematicMath(text, kind)).toEqual(expected);
  });

  it("does not implicitly parse bare signs or numeric values", () => {
    expect(parseSchematicMath("+", "route-marker")).toBeNull();
    expect(parseSchematicMath("1.2 V", "route-marker")).toBeNull();
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
      '<tspan data-text-run="base" style="font-style:italic;font-weight:700">V</tspan><tspan data-text-run="subscript" font-size="68%" baseline-shift="-0.3em" style="font-style:italic;font-weight:700">IN</tspan><tspan data-text-run="suffix" baseline-shift="baseline" dy="0.3em" style="font-style:normal;font-weight:400">+</tspan>',
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
    expect(schematicTextFontSize("route-marker", razaviTextbookProfile)).toBe(
      16,
    );
  });
});
