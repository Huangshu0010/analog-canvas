import { describe, expect, it } from "vitest";

import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";

import {
  instanceVisibleHitBox,
  visibleSymbolLocalBounds,
} from "./selection-geometry";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("selection geometry", () => {
  it("uses painted geometry and pins instead of unused viewBox space", () => {
    const resolved = resolver.resolve("vdd");
    expect(resolved).toBeDefined();
    const bounds = visibleSymbolLocalBounds(resolved!);
    expect(bounds.x).toBeGreaterThan(resolved!.definition.viewBox.x);
    expect(bounds.width).toBeLessThan(resolved!.definition.viewBox.width);
    expect(bounds.height).toBeLessThan(resolved!.definition.viewBox.height);
  });

  it("transforms the tight envelope with the instance placement", () => {
    const resolved = resolver.resolve("vdd");
    expect(resolved).toBeDefined();
    const localBounds = visibleSymbolLocalBounds(resolved!);
    const bounds = instanceVisibleHitBox(
      {
        id: "VDD1",
        symbolId: "vdd",
        placement: {
          position: { x: 100, y: 200 },
          rotation: 90,
          mirror: "none",
        },
        properties: {},
      },
      resolved!,
    );
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeCloseTo(localBounds.height);
    expect(bounds!.height).toBeCloseTo(localBounds.width);
  });
});
