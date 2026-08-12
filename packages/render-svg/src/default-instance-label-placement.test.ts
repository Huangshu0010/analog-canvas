import { describe, expect, it } from "vitest";

import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

import { defaultInstanceLabelPlacement } from "./default-instance-label-placement.js";
import { razaviTextbookProfile } from "./style-profile.js";

function placed(
  symbolId: string,
  rotation: 0 | 90 | 180 | 270 = 0,
  mirror: "none" | "x" = "none",
  symbolVariantId?: string,
) {
  const resolved = new InMemorySymbolResolver(builtInSymbols).resolve(
    symbolId,
    symbolVariantId,
  );
  if (!resolved) throw new Error(`Missing symbol: ${symbolId}`);
  const placement = defaultInstanceLabelPlacement(
    {
      id: `${symbolId}-1`,
      symbolId,
      ...(symbolVariantId ? { symbolVariantId } : {}),
      placement: { position: { x: 100, y: 100 }, rotation, mirror },
      properties: {},
    },
    resolved,
    razaviTextbookProfile,
  );
  if (!placement) throw new Error("Placed instance must receive a label");
  return placement;
}

describe("semantic default instance-label placement", () => {
  it("keeps passive and source labels on their local right side", () => {
    expect(placed("resistor")).toMatchObject({
      position: { x: 112, y: 105 },
      alignment: "start",
    });
    expect(placed("voltage-source")).toMatchObject({
      position: { x: 113, y: 105 },
      alignment: "start",
    });
  });

  it("moves a rotated passive side label with the symbol", () => {
    expect(placed("capacitor", 90)).toMatchObject({
      position: { x: 95, y: 125 },
      alignment: "middle",
    });
  });

  it("places Port text on the endpoint's reverse extension", () => {
    expect(placed("port")).toMatchObject({
      position: { x: 88, y: 105 },
      alignment: "end",
    });
  });

  it("places MOS text opposite the gate and below the channel center", () => {
    expect(placed("nmos")).toMatchObject({
      position: { x: 123, y: 108 },
      alignment: "start",
    });
    expect(placed("nmos", 0, "none", "textbook-3terminal")).toMatchObject({
      position: { x: 113, y: 108 },
      alignment: "start",
    });
  });

  it("uses visible glyph edges for vertical MOS orientations", () => {
    expect(placed("nmos", 90, "none", "textbook-3terminal")).toMatchObject({
      position: { x: 92, y: 129 },
      semanticPosition: { x: 92, y: 113 },
      alignment: "middle",
    });
    expect(placed("nmos", 270, "none", "textbook-3terminal")).toMatchObject({
      position: { x: 108, y: 82 },
      semanticPosition: { x: 108, y: 87 },
      alignment: "middle",
    });
  });

  it("keeps the outward side alignment after mirroring", () => {
    expect(placed("nmos", 0, "x")).toMatchObject({
      position: { x: 78, y: 108 },
      alignment: "end",
    });
  });
});
