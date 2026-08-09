import { describe, expect, it } from "vitest";

import { buildManualWirePath } from "./wire-path";

describe("buildManualWirePath", () => {
  it("escapes a horizontal terminal before turning vertically", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 }, outward: { x: -1, y: 0 } },
      { point: { x: 100, y: 200 } },
    );

    expect(path.points).toEqual([
      { x: 100, y: 100 },
      { x: 90, y: 100 },
      { x: 90, y: 200 },
      { x: 100, y: 200 },
    ]);
    expect(path.segmentModes).toEqual(["escape", "auto", "auto"]);
  });

  it("approaches the target against its outward direction", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 } },
      { point: { x: 200, y: 100 }, outward: { x: 0, y: -1 } },
    );

    expect(path.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 90 },
      { x: 200, y: 90 },
      { x: 200, y: 100 },
    ]);
    expect(path.segmentModes).toEqual(["auto", "auto", "escape"]);
  });

  it("keeps transformed directions as signed vectors rather than axes", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 }, outward: { x: 0, y: 1 } },
      { point: { x: 180, y: 40 }, outward: { x: 1, y: 0 } },
    );

    expect(path.points.slice(0, 2)).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 110 },
    ]);
    expect(path.points.slice(-2)).toEqual([
      { x: 190, y: 40 },
      { x: 180, y: 40 },
    ]);
  });
});
