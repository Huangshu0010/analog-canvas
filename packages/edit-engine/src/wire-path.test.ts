import { describe, expect, it } from "vitest";

import { buildManualWirePath } from "./routing-planner.js";

describe("buildManualWirePath", () => {
  it("keeps a direct terminal right-angle at the exact electrical endpoint", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 } },
      { point: { x: 100, y: 200 } },
    );

    expect(path.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 200 },
    ]);
    expect(path.segmentModes).toEqual(["manual"]);
  });

  it("adds only the one necessary orthogonal bend", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 } },
      { point: { x: 200, y: 200 } },
    );

    expect(path.points).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ]);
    expect(path.segmentModes).toEqual(["manual", "manual"]);
  });

  it("normalizes redundant manual vertices without adding terminal geometry", () => {
    const path = buildManualWirePath(
      { point: { x: 100, y: 100 } },
      { point: { x: 300, y: 300 } },
      [{ x: 100, y: 200 }],
    );

    expect(path.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ]);
  });

  it("allows the editor's zero-length source preview", () => {
    expect(
      buildManualWirePath(
        { point: { x: 100, y: 100 } },
        { point: { x: 100, y: 100 } },
      ),
    ).toEqual({
      points: [{ x: 100, y: 100 }],
      waypoints: [],
      segmentModes: [],
    });
  });
});
