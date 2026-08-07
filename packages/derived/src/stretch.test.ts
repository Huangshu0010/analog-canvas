import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { proposeGroupStretch } from "./stretch.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("group route stretch", () => {
  it("translates a route whose two terminal endpoints share one move delta", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "R2",
        symbolId: "resistor",
        placement: {
          position: { x: 260, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-1",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-1",
      netId: "net-1",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [
        { x: 180, y: 100 },
        { x: 180, y: 140 },
        { x: 230, y: 140 },
      ],
      segmentModes: ["manual", "manual", "manual", "manual"],
    });

    expect(
      proposeGroupStretch(document, resolver, [
        { instanceId: "R1", position: { x: 120, y: 130 } },
        { instanceId: "R2", position: { x: 280, y: 130 } },
      ]),
    ).toEqual([
      {
        routeId: "route-1",
        waypoints: [
          { x: 200, y: 130 },
          { x: 200, y: 170 },
          { x: 250, y: 170 },
        ],
        segmentModes: ["manual", "manual", "manual", "manual"],
      },
    ]);
  });

  it("rejects a protected route before proposing a partial move", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(
      {
        id: "R1",
        symbolId: "resistor",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "R2",
        symbolId: "resistor",
        placement: {
          position: { x: 260, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-1",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.routes.push({
      id: "route-1",
      netId: "net-1",
      from: { kind: "terminal", instanceId: "R1", pinName: "2" },
      to: { kind: "terminal", instanceId: "R2", pinName: "1" },
      waypoints: [],
      segmentModes: ["locked"],
    });

    expect(() =>
      proposeGroupStretch(document, resolver, [
        { instanceId: "R1", position: { x: 120, y: 100 } },
        { instanceId: "R2", position: { x: 280, y: 100 } },
      ]),
    ).toThrow("locked segment");
  });
});
