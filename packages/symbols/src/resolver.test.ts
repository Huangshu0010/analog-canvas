import { describe, expect, it } from "vitest";

import { InMemorySymbolResolver } from "./resolver.js";
import { SymbolDefinitionSchema } from "./schema.js";

const resistor = {
  schemaVersion: 1 as const,
  id: "resistor",
  name: "Resistor",
  viewBox: { x: -20, y: -10, width: 40, height: 20 },
  pins: [
    {
      name: "1",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west" as const,
      presentation: { visibility: "visible" as const },
    },
    {
      name: "2",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east" as const,
      presentation: { visibility: "visible" as const },
    },
  ],
  primitives: [
    { kind: "line" as const, from: { x: -10, y: 0 }, to: { x: 10, y: 0 } },
  ],
  variants: [{ id: "compact", hiddenPinNames: [] }],
  aliases: ["res"],
};

describe("Symbol Resolver boundary", () => {
  it("resolves canonical IDs, aliases, and variants", () => {
    const resolver = new InMemorySymbolResolver([resistor]);
    expect(resolver.resolve("res")?.definition.id).toBe("resistor");
    expect(resolver.resolve("resistor", "compact")?.variant?.id).toBe(
      "compact",
    );
    expect(resolver.resolve("missing")).toBeUndefined();
  });

  it("rejects duplicate electrical pin names", () => {
    expect(
      SymbolDefinitionSchema.safeParse({
        ...resistor,
        pins: [resistor.pins[0], resistor.pins[0]],
      }).success,
    ).toBe(false);
  });

  it("does not remove an electrical pin when a variant hides it", () => {
    const hidden = SymbolDefinitionSchema.parse({
      ...resistor,
      variants: [{ id: "implicit-terminal", hiddenPinNames: ["2"] }],
    });
    expect(hidden.pins.map((pin) => pin.name)).toEqual(["1", "2"]);
  });

  it("generates a deterministic positional block for every imported terminal", () => {
    const resolver = new InMemorySymbolResolver([resistor]);
    const generated = resolver.resolve("generic-block-5")?.definition;
    expect(generated?.pins.map((pin) => pin.name)).toEqual([
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
    ]);
    expect(resolver.resolve("generic-block-5")?.definition).toBe(generated);
    expect(resolver.resolve("generic-block-0")).toBeUndefined();
  });
});
