import { describe, expect, it } from "vitest";

import { cellSymbolLayoutEditAtLocalPoint } from "./use-cell-symbol-layout";

const layout = {
  body: { left: -40, right: 40, top: -30, bottom: 30 },
};

describe("cell symbol layout session", () => {
  it("snaps body resize intent to the symbol grid", () => {
    expect(
      cellSymbolLayoutEditAtLocalPoint(
        layout,
        { kind: "body" },
        { x: 47, y: 34 },
      ),
    ).toEqual({ kind: "body", width: 90, height: 70 });
  });

  it("chooses the nearest pin side and snaps its signed offset", () => {
    expect(
      cellSymbolLayoutEditAtLocalPoint(
        layout,
        { kind: "pin", terminalId: "terminal-in" },
        { x: -38, y: 17 },
      ),
    ).toEqual({
      kind: "pin",
      terminalId: "terminal-in",
      side: "west",
      offset: 20,
    });
  });
});
