import { describe, expect, it } from "vitest";

import { migrateLegacySchematicText } from "./schematic-text.js";
import { semanticTextDocument } from "./semantic-text.js";

describe("schematic RichText boundaries", () => {
  it("converts historical markup only at the migration boundary", () => {
    expect(migrateLegacySchematicText("\\it{V}_{DD}", "power-label")).toEqual({
      runs: [
        {
          kind: "span",
          style: "italic",
          children: [{ kind: "text", value: "V" }],
        },
        {
          kind: "span",
          style: "subscript",
          children: [{ kind: "text", value: "DD" }],
        },
      ],
    });
  });

  it("constructs formatting from current semantic identifiers, not markup", () => {
    expect(semanticTextDocument("M1", "instance-label")).toMatchObject({
      runs: [
        { kind: "span", style: "italic" },
        { kind: "span", style: "subscript" },
      ],
    });
    expect(semanticTextDocument("\\it{V}_{DD}", "power-label")).toEqual({
      runs: [{ kind: "text", value: "\\it{V}_{DD}" }],
    });
  });
});
