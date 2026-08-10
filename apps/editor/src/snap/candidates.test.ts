import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildSceneSnapTargets } from "./candidates";

describe("snap candidate builder", () => {
  it("exposes visible Guides as axis-only candidates", () => {
    const document = createEmptyDocument("doc", "Snap");
    document.drafting = {
      objects: [],
      guides: [
        {
          id: "g1",
          axis: "vertical",
          coordinate: 120,
          visible: true,
          locked: false,
        },
      ],
    };

    const targets = buildSceneSnapTargets(
      document,
      new InMemorySymbolResolver([]),
      [],
    );

    expect(targets).toContainEqual({
      id: "guide:g1",
      point: { x: 120, y: 0 },
      kind: "guide",
      axes: ["x"],
    });
  });

  it("excludes every moving instance from static snap targets", () => {
    const document = createEmptyDocument("doc", "Snap");
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });

    const targets = buildSceneSnapTargets(
      document,
      new InMemorySymbolResolver(builtInSymbols),
      [],
      new Set(["R1"]),
    );

    expect(targets.some((target) => target.id.startsWith("instance:R1:"))).toBe(
      false,
    );
  });
});
