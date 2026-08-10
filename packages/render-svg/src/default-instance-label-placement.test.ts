import { describe, expect, it } from "vitest";

import { getRazaviCatalogSymbol } from "@icm/symbols";

import { defaultInstanceLabelPlacement } from "./default-instance-label-placement.js";
import { razaviTextbookProfile } from "./style-profile.js";

function placed(
  symbolId: string,
  rotation: 0 | 90 | 180 | 270 = 0,
  mirror: "none" | "x" = "none",
) {
  const definition = getRazaviCatalogSymbol(symbolId);
  if (!definition) throw new Error(`Missing symbol: ${symbolId}`);
  const placement = defaultInstanceLabelPlacement(
    {
      id: `${symbolId}-1`,
      symbolId,
      placement: { position: { x: 100, y: 100 }, rotation, mirror },
      properties: {},
    },
    definition,
    razaviTextbookProfile,
  );
  if (!placement) throw new Error("Placed instance must receive a label");
  return placement;
}

describe("semantic default instance-label placement", () => {
  it("keeps passive and source labels on their local right side", () => {
    expect(placed("resistor")).toMatchObject({
      position: { x: 121, y: 105 },
      alignment: "start",
    });
    expect(placed("voltage-source")).toMatchObject({
      position: { x: 126, y: 105 },
      alignment: "start",
    });
  });

  it("moves a rotated passive side label with the symbol", () => {
    expect(placed("capacitor", 90)).toMatchObject({
      position: { x: 95, y: 123 },
      alignment: "middle",
    });
  });

  it("places Port text on the endpoint's reverse extension", () => {
    expect(placed("port")).toMatchObject({
      position: { x: 75, y: 105 },
      alignment: "end",
    });
  });

  it("places MOS text opposite the gate and below the channel center", () => {
    expect(placed("nmos")).toMatchObject({
      position: { x: 116, y: 108 },
      alignment: "start",
    });
  });

  it("keeps the outward side alignment after mirroring", () => {
    expect(placed("nmos", 0, "x")).toMatchObject({
      position: { x: 84, y: 108 },
      alignment: "end",
    });
  });
});
