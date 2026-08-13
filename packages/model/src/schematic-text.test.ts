import { describe, expect, it } from "vitest";

import { parseSchematicMath, schematicTextDocument } from "./schematic-text.js";

describe("schematic semantic text", () => {
  it.each([
    ["M1", "instance-label", { base: "M", subscript: "1", style: "math" }],
    ["VDD", "power-label", { base: "V", subscript: "DD", style: "math" }],
    [
      "VIN+",
      "route-marker",
      { base: "V", subscript: "IN", suffix: "+", style: "math" },
    ],
  ] as const)("derives %s from its semantic kind", (text, kind, expected) => {
    expect(parseSchematicMath(text, kind)).toEqual(expected);
  });

  it.each(["V^2", "\\frac{1}{2}"])(
    "does not treat unsupported notation %s as semantic formatting",
    (text) => {
      expect(parseSchematicMath(text, "net-label")).toBeNull();
      expect(schematicTextDocument(text, "net-label")).toEqual({
        runs: [{ kind: "text", value: text }],
      });
    },
  );
});
