import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  defaultInstanceLabelPlacement,
  isBjtSymbol,
  isMosSymbol,
} from "./instance-label-placement.js";
import { resolveSchematicStyleProfile } from "./style-profile.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const profile = resolveSchematicStyleProfile("razavi-textbook-v1");

function placedInstance(symbolId: "nmos" | "npn" | "pnp", rotation = 0) {
  return {
    id: "Q1",
    symbolId,
    placement: {
      position: { x: 100, y: 100 },
      rotation: rotation as 0 | 90 | 180 | 270,
      mirror: "none" as const,
    },
    properties: {},
  };
}

describe("instance label placement", () => {
  it("uses the MOS channel-side rule for NPN and PNP names", () => {
    const document = createEmptyDocument("labels", "Labels");
    for (const symbolId of ["npn", "pnp"] as const) {
      const instance = placedInstance(symbolId);
      document.instances = [instance];
      const resolved = resolver.resolve(symbolId);
      if (!resolved) throw new Error(`missing ${symbolId}`);

      expect(isBjtSymbol(resolved)).toBe(true);
      expect(isMosSymbol(resolved)).toBe(false);
      expect(
        defaultInstanceLabelPlacement(instance, resolved, profile),
      ).toMatchObject({
        alignment: "start",
        position: {
          x: expect.any(Number),
          y: expect.any(Number),
        },
      });
      expect(
        defaultInstanceLabelPlacement(instance, resolved, profile)!.position.x,
      ).toBeGreaterThan(instance.placement.position.x);
    }
  });

  it("keeps BJT labels upright and outside the symbol after rotation", () => {
    const instance = placedInstance("npn", 90);
    const resolved = resolver.resolve("npn");
    if (!resolved) throw new Error("missing npn");

    expect(defaultInstanceLabelPlacement(instance, resolved, profile)).toEqual(
      expect.objectContaining({
        alignment: "middle",
        position: expect.objectContaining({ y: expect.any(Number) }),
      }),
    );
    expect(
      defaultInstanceLabelPlacement(instance, resolved, profile)!.position.y,
    ).toBeGreaterThan(instance.placement.position.y);
  });
});
