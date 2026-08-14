import { describe, expect, it } from "vitest";

import { fitCameraToBounds, normalizeCameraRect } from "./fit-view";

describe("fitCameraToBounds", () => {
  it("rounds fractional visual bounds outward to the editor grid", () => {
    expect(
      fitCameraToBounds({ x: 97.55, y: -43.2, width: 61.3, height: 16.7 }, 10),
    ).toEqual({ x: 90, y: -50, width: 70, height: 30 });
  });

  it("preserves an already aligned camera rectangle", () => {
    expect(
      fitCameraToBounds({ x: -40, y: 20, width: 960, height: 640 }, 10),
    ).toEqual({ x: -40, y: 20, width: 960, height: 640 });
  });

  it("normalizes zoom, pan, and focus camera updates onto the grid", () => {
    expect(
      normalizeCameraRect(
        { x: 97.55, y: -43.2, width: 61.3, height: 16.7 },
        10,
      ),
    ).toEqual({ x: 100, y: -40, width: 60, height: 20 });
  });
});
