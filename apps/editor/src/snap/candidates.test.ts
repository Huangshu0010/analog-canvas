import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  buildRectangleEdgeSnapAnchors,
  buildSceneSnapTargets,
} from "./candidates";

describe("snap candidate builder", () => {
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

  it("builds one Wire snap anchor at each rectangle edge center", () => {
    const document = createEmptyDocument("doc", "Snap");
    document.drafting = {
      objects: [
        {
          id: "rectangle-1",
          kind: "rectangle",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 100, y: 100 } },
          center: { x: 100, y: 100 },
          width: 40,
          height: 20,
          rotation: 0,
          lineStyle: "solid",
        },
      ],
    };

    const targets = buildRectangleEdgeSnapAnchors(
      document,
      new InMemorySymbolResolver(builtInSymbols),
    );

    expect(targets).toEqual([
      {
        id: "drafting:rectangle-1:edge-center:0",
        point: { x: 100, y: 90 },
        kind: "drafting",
      },
      {
        id: "drafting:rectangle-1:edge-center:1",
        point: { x: 120, y: 100 },
        kind: "drafting",
      },
      {
        id: "drafting:rectangle-1:edge-center:2",
        point: { x: 100, y: 110 },
        kind: "drafting",
      },
      {
        id: "drafting:rectangle-1:edge-center:3",
        point: { x: 80, y: 100 },
        kind: "drafting",
      },
    ]);
  });
});
