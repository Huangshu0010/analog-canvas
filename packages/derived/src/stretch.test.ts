import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { proposeGroupMove, proposeGroupStretch } from "./stretch.js";

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

  it("selects and translates internal Junctions, routes, and Net labels", () => {
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
      name: "SIGNAL",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.junctions.push({
      id: "junction-1",
      netId: "net-1",
      position: { x: 180, y: 100 },
    });
    document.routes.push(
      {
        id: "route-1",
        netId: "net-1",
        from: { kind: "terminal", instanceId: "R1", pinName: "2" },
        to: { kind: "junction", junctionId: "junction-1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-2",
        netId: "net-1",
        from: { kind: "junction", junctionId: "junction-1" },
        to: { kind: "terminal", instanceId: "R2", pinName: "1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );
    document.annotations.push({
      id: "net-label",
      kind: "net-label",
      text: "SIGNAL",
      position: { x: 180, y: 90 },
      attachedObjectId: "net-1",
      offset: { x: 0, y: -10 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });

    expect(
      proposeGroupMove(document, resolver, [
        { instanceId: "R1", position: { x: 120, y: 130 } },
        { instanceId: "R2", position: { x: 280, y: 130 } },
      ]),
    ).toMatchObject({
      internalNetIds: ["net-1"],
      internalRouteIds: ["route-1", "route-2"],
      junctions: [{ junctionId: "junction-1", position: { x: 200, y: 130 } }],
      annotations: [
        { annotationId: "net-label", position: { x: 200, y: 120 } },
      ],
      routes: [
        { routeId: "route-1", waypoints: [] },
        { routeId: "route-2", waypoints: [] },
      ],
    });
  });
});
