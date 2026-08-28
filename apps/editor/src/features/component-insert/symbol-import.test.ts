import { describe, expect, it } from "vitest";

import { parseImportedSymbolJson } from "./symbol-import";

const validSymbolJson = JSON.stringify({
  schemaVersion: 1,
  id: "imported-block",
  name: "Imported Block",
  viewBox: { x: -20, y: -20, width: 40, height: 40 },
  pins: [
    {
      name: "A",
      role: "terminal",
      at: { x: -20, y: 0 },
      direction: "west",
      presentation: { visibility: "visible" },
    },
  ],
  primitives: [{ kind: "line", from: { x: -10, y: 0 }, to: { x: 10, y: 0 } }],
  variants: [],
});

describe("parseImportedSymbolJson", () => {
  it("accepts a valid Symbol DSL definition and preserves the embedded id", () => {
    const result = parseImportedSymbolJson(validSymbolJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.symbol.name).toBe("Imported Block");
    // The embedded id is preserved in the parsed payload; the runtime re-key
    // happens at the persistence boundary, not here.
    expect(result.symbol.id).toBe("imported-block");
  });

  it("rejects malformed JSON with a readable message", () => {
    const result = parseImportedSymbolJson("{ not json");
    expect(result).toEqual({
      ok: false,
      message: "The symbol file is not valid JSON",
    });
  });

  it("rejects a schema violation and reports the first issue location", () => {
    const broken = JSON.stringify({
      schemaVersion: 1,
      id: "broken",
      name: "Broken",
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      pins: [{ name: "1", role: "passive", at: { x: 0, y: 0 } }],
      primitives: [],
      variants: [],
    });
    const result = parseImportedSymbolJson(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("pins.0");
  });
});
