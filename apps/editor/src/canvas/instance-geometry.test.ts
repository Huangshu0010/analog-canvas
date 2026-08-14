import { describe, expect, it } from "vitest";

import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";

import {
  instanceVisibleHitBox,
  visibleSymbolLocalBounds,
} from "./instance-geometry";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("selection geometry", () => {
  it("keeps painted geometry and pins inside the Symbol viewBox", () => {
    const resolved = resolver.resolve("opamp");
    expect(resolved).toBeDefined();
    const bounds = visibleSymbolLocalBounds(resolved!);
    expect(bounds.x).toBeGreaterThanOrEqual(resolved!.definition.viewBox.x);
    expect(bounds.width).toBeLessThanOrEqual(
      resolved!.definition.viewBox.width,
    );
    expect(bounds.height).toBeLessThanOrEqual(
      resolved!.definition.viewBox.height,
    );
  });

  it("transforms the tight envelope with the instance placement", () => {
    const resolved = resolver.resolve("opamp");
    expect(resolved).toBeDefined();
    const localBounds = visibleSymbolLocalBounds(resolved!);
    const bounds = instanceVisibleHitBox(
      {
        id: "U1",
        symbolId: "opamp",
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
