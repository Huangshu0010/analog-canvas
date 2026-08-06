import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  deriveCrossings,
  deriveFlightlines,
  deriveVisibleConnectivity,
  normalizeRouteGeometry,
  proposeLocalStretch,
  resolveEndpointPoint,
} from "./index.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function documentFixture() {
  return parseProject(
    readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-3-routing/project.icproj.json",
      ),
      "utf8",
    ),
  ).documents[0]!;
}

const terminal = (instanceId: string) => ({
  kind: "terminal" as const,
  instanceId,
  pinName: "P1",
});

describe("derived connectivity and route geometry", () => {
  it("resolves transformed Symbol pins and computes stable flightline MSTs", () => {
    const document = documentFixture();
    expect(resolveEndpointPoint(document, resolver, terminal("A"))).toEqual({
      x: 100,
      y: 300,
    });
    expect(resolveEndpointPoint(document, resolver, terminal("B"))).toEqual({
      x: 500,
      y: 300,
    });
    expect(resolveEndpointPoint(document, resolver, terminal("C"))).toEqual({
      x: 300,
      y: 100,
    });
    expect(resolveEndpointPoint(document, resolver, terminal("D"))).toEqual({
      x: 300,
      y: 500,
    });

    const flightlines = deriveFlightlines(document, resolver);
    expect(
      flightlines.map((line) => [
        line.netId,
        line.from.kind === "terminal" ? line.from.instanceId : "other",
        line.to.kind === "terminal" ? line.to.instanceId : "other",
        line.distance,
      ]),
    ).toEqual([
      ["net-h", "B", "E", 260],
      ["net-h", "A", "E", 340],
      ["net-v", "C", "D", 400],
    ]);
    expect(deriveFlightlines(document, resolver)).toEqual(flightlines);
  });

  it("treats geometric crossing as separate explicit graph components", () => {
    const document = documentFixture();
    document.routes = [
      {
        id: "route-h",
        netId: "net-h",
        from: terminal("A"),
        to: terminal("B"),
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-v",
        netId: "net-v",
        from: terminal("C"),
        to: terminal("D"),
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    expect(deriveCrossings(document, resolver)).toEqual([
      {
        routeAId: "route-h",
        routeBId: "route-v",
        netAId: "net-h",
        netBId: "net-v",
        point: { x: 300, y: 300 },
        kind: "crossing",
      },
    ]);
    const connectivity = deriveVisibleConnectivity(document, resolver);
    expect(
      connectivity.find((net) => net.netId === "net-h")?.components,
    ).toHaveLength(2);
    expect(
      connectivity.find((net) => net.netId === "net-v")?.components,
    ).toHaveLength(1);
    expect(deriveFlightlines(document, resolver)).toHaveLength(1);
  });

  it("normalizes duplicate/collinear points and proposes local endpoint stretch", () => {
    expect(
      normalizeRouteGeometry(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
        ],
        ["auto", "manual", "escape", "trunk"],
      ),
    ).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
      ],
      segmentModes: ["manual", "trunk"],
    });

    const document = documentFixture();
    document.routes = [
      {
        id: "route-h",
        netId: "net-h",
        from: terminal("A"),
        to: terminal("B"),
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    expect(
      proposeLocalStretch(document, resolver, "A", { x: 140, y: 360 }),
    ).toEqual([
      {
        routeId: "route-h",
        waypoints: [{ x: 500, y: 360 }],
        segmentModes: ["manual", "manual"],
      },
    ]);
  });

  it("rejects local stretch beside a protected segment", () => {
    const document = documentFixture();
    document.routes = [
      {
        id: "route-h",
        netId: "net-h",
        from: terminal("A"),
        to: terminal("B"),
        waypoints: [],
        segmentModes: ["locked"],
      },
    ];
    expect(() =>
      proposeLocalStretch(document, resolver, "A", { x: 140, y: 360 }),
    ).toThrow(/protected adjacent segment/u);
  });
});
