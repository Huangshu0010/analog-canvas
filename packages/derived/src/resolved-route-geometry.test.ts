import { createEmptyProject } from "@icm/model";
import type { SchematicDocument } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { resolveRouteAnchorJoins, resolveRouteGeometry } from "./index.js";

// Two-pin symbol: pin R faces east, pin L faces west; used for terminal
// endpoint-join tests where the resolved outward direction matters.
const dual = {
  schemaVersion: 1 as const,
  id: "dual",
  name: "Dual",
  viewBox: { x: -20, y: -20, width: 40, height: 40 },
  pins: [
    {
      name: "L",
      role: "passive",
      at: { x: -20, y: 0 },
      direction: "west" as const,
      presentation: { visibility: "visible" as const },
    },
    {
      name: "R",
      role: "passive",
      at: { x: 20, y: 0 },
      direction: "east" as const,
      presentation: { visibility: "visible" as const },
    },
  ],
  primitives: [
    { kind: "line" as const, from: { x: -10, y: 0 }, to: { x: 10, y: 0 } },
  ],
  variants: [],
  aliases: [],
};

const resolver = new InMemorySymbolResolver([dual]);

function emptyDocument(id: string): SchematicDocument {
  return createEmptyProject(id, id, id).documents[0]!;
}

function junctionRouteDocument(): SchematicDocument {
  const document = emptyDocument("r");
  document.junctions = [
    { id: "j1", netId: "n", position: { x: 0, y: 0 } },
    { id: "j2", netId: "n", position: { x: 100, y: 100 } },
  ];
  document.routes = [
    {
      id: "route-j",
      netId: "n",
      from: { kind: "junction", junctionId: "j1" },
      to: { kind: "junction", junctionId: "j2" },
      waypoints: [{ x: 50, y: 0 }],
      segmentModes: ["manual", "auto"],
    },
  ];
  return document;
}

describe("ResolvedRouteGeometry", () => {
  it("centerline equals routePolyline and returns null on unresolved endpoint", () => {
    const document = junctionRouteDocument();
    const route = document.routes[0]!;
    expect(resolveRouteGeometry(document, resolver, route)?.centerline).toEqual(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 100 },
      ],
    );

    const bad: (typeof document.routes)[number] = {
      id: "route-x",
      netId: "n",
      from: { kind: "junction", junctionId: "missing" },
      to: { kind: "junction", junctionId: "j2" },
      waypoints: [],
      segmentModes: ["manual"],
    };
    expect(resolveRouteGeometry(document, resolver, bad)).toBeNull();
  });

  it("produces one typed segment per centerline segment with stable index and mode", () => {
    const geometry = resolveRouteGeometry(
      junctionRouteDocument(),
      resolver,
      junctionRouteDocument().routes[0]!,
    )!;
    expect(geometry.segments).toEqual([
      { index: 0, from: { x: 0, y: 0 }, to: { x: 50, y: 0 }, mode: "manual" },
      {
        index: 1,
        from: { x: 50, y: 0 },
        to: { x: 100, y: 100 },
        mode: "auto",
      },
    ]);
    expect(geometry.hitGeometry.map((hit) => hit.horizontal)).toEqual([
      true,
      false,
    ]);
  });

  it("types vertices as junction/bend and distinguishes terminal/port/route-anchor", () => {
    const junctionGeometry = resolveRouteGeometry(
      junctionRouteDocument(),
      resolver,
      junctionRouteDocument().routes[0]!,
    )!;
    expect(junctionGeometry.vertices.map((vertex) => vertex.kind)).toEqual([
      "junction",
      "bend",
      "junction",
    ]);

    // Port endpoint at one end, terminal at the other.
    const document = emptyDocument("v");
    document.instances = [
      {
        id: "I1",
        symbolId: "dual",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    ];
    document.ports = [
      {
        id: "p1",
        name: "in",
        direction: "passive",
        position: { x: 0, y: 100 },
      },
    ];
    document.junctions = [
      {
        id: "ja",
        netId: "n",
        position: { x: 300, y: 100 },
        role: "route-anchor",
      },
    ];
    document.routes = [
      {
        id: "route-mixed",
        netId: "n",
        from: { kind: "port", portId: "p1" },
        to: { kind: "terminal", instanceId: "I1", pinName: "R" },
        waypoints: [{ x: 100, y: 100 }],
        segmentModes: ["manual", "manual"],
      },
      {
        id: "route-anchor-end",
        netId: "n",
        from: { kind: "terminal", instanceId: "I1", pinName: "L" },
        to: { kind: "junction", junctionId: "ja" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    const mixed = resolveRouteGeometry(
      document,
      resolver,
      document.routes[0]!,
    )!;
    expect(mixed.vertices.map((vertex) => vertex.kind)).toEqual([
      "port",
      "bend",
      "terminal",
    ]);
    const anchored = resolveRouteGeometry(
      document,
      resolver,
      document.routes[1]!,
    )!;
    expect(anchored.vertices.at(-1)!.kind).toBe("route-anchor");
  });

  it("computes bounds from the centerline", () => {
    const geometry = resolveRouteGeometry(
      junctionRouteDocument(),
      resolver,
      junctionRouteDocument().routes[0]!,
    )!;
    expect(geometry.bounds).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 100, y: 100 },
    });
  });

  it("emits a terminal endpointJoin with pin outward and route direction, and omits non-terminal ends", () => {
    const document = emptyDocument("e");
    document.instances = [
      {
        id: "I1",
        symbolId: "dual",
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    ];
    document.junctions = [
      { id: "j1", netId: "n", position: { x: 200, y: 100 } },
    ];
    document.routes = [
      {
        // From terminal R {120,100} (east outward) to junction j1 {200,100}.
        id: "route-t",
        netId: "n",
        from: { kind: "terminal", instanceId: "I1", pinName: "R" },
        to: { kind: "junction", junctionId: "j1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    const geometry = resolveRouteGeometry(
      document,
      resolver,
      document.routes[0]!,
    )!;
    expect(geometry.endpointJoins).toEqual([
      {
        kind: "terminal-miter",
        routeId: "route-t",
        at: { x: 120, y: 100 },
        pinOutward: { x: 1, y: 0 },
        routeDirection: { x: 1, y: 0 },
      },
    ]);

    // A port→junction route has no terminal end and therefore no endpointJoin.
    const portDocument = emptyDocument("e2");
    portDocument.ports = [
      { id: "p1", name: "in", direction: "passive", position: { x: 0, y: 0 } },
    ];
    portDocument.junctions = [
      { id: "j1", netId: "n", position: { x: 100, y: 0 } },
    ];
    portDocument.routes = [
      {
        id: "route-p",
        netId: "n",
        from: { kind: "port", portId: "p1" },
        to: { kind: "junction", junctionId: "j1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    expect(
      resolveRouteGeometry(portDocument, resolver, portDocument.routes[0]!)!
        .endpointJoins,
    ).toEqual([]);
  });
});

describe("resolveRouteAnchorJoins", () => {
  function anchorDocument(degree: 1 | 2): SchematicDocument {
    const document = emptyDocument("a");
    document.ports = [
      {
        id: "port-left",
        name: "l",
        direction: "passive",
        position: { x: 0, y: 100 },
      },
      {
        id: "port-right",
        name: "r",
        direction: "passive",
        position: { x: 200, y: 100 },
      },
    ];
    document.junctions = [
      {
        id: "ja",
        netId: "n",
        position: { x: 100, y: 100 },
        role: "route-anchor",
      },
    ];
    document.routes = [
      {
        id: "r1",
        netId: "n",
        from: { kind: "port", portId: "port-left" },
        to: { kind: "junction", junctionId: "ja" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    if (degree === 2) {
      document.routes.push({
        id: "r2",
        netId: "n",
        from: { kind: "junction", junctionId: "ja" },
        to: { kind: "port", portId: "port-right" },
        waypoints: [],
        segmentModes: ["manual"],
      });
    }
    return document;
  }

  it("joins a degree-2 route-anchor with its two route-end directions", () => {
    expect(resolveRouteAnchorJoins(anchorDocument(2), resolver)).toEqual([
      {
        kind: "route-anchor-miter",
        junctionId: "ja",
        at: { x: 100, y: 100 },
        // r1 ends at the anchor from the left; r2 leaves to the right.
        directions: [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ],
      },
    ]);
  });

  it("excludes a degree-1 (free-end) route-anchor", () => {
    expect(resolveRouteAnchorJoins(anchorDocument(1), resolver)).toEqual([]);
  });
});
