import { describe, expect, it } from "vitest";

import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";

import {
  exceedsDragThreshold,
  instanceVisibleHitBox,
  mayStartSelectedDrag,
  visibleSymbolLocalBounds,
} from "./selection-geometry";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("selection geometry", () => {
  it("does not treat pointer jitter as a drag", () => {
    expect(exceedsDragThreshold({ x: 10, y: 10 }, { x: 12, y: 12 }, 4)).toBe(
      false,
    );
    expect(exceedsDragThreshold({ x: 10, y: 10 }, { x: 14, y: 10 }, 4)).toBe(
      true,
    );
  });

  it("requires an existing selection before a move gesture may begin", () => {
    expect(mayStartSelectedDrag(false, false)).toBe(false);
    expect(mayStartSelectedDrag(true, true)).toBe(false);
    expect(mayStartSelectedDrag(true, false)).toBe(true);
  });

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
