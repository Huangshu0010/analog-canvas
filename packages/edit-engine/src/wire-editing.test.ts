import type { RouteEndpoint } from "@icm/model";
import { describe, expect, it } from "vitest";

import {
  createFreeWireAnchor,
  createRouteWireAnchor,
  proposeWireCommit,
} from "./routing-planner.js";
import type { WireSource } from "./routing-planner.js";

function source(
  endpoint: RouteEndpoint,
  point: { x: number; y: number },
  netId: string | null = null,
  routePresentation?: WireSource["routePresentation"],
): WireSource {
  return {
    endpoint,
    point,
    netId,
    preludeEdits: [],
    ...(routePresentation ? { routePresentation } : {}),
  };
}

describe("wire editing proposals", () => {
  it("creates one net and a deterministic persisted route for loose endpoints", () => {
    const proposal = proposeWireCommit(
      source({ kind: "port", portId: "in" }, { x: 0, y: 0 }),
      source({ kind: "port", portId: "out" }, { x: 40, y: 20 }),
      [],
      7,
    );

    expect(proposal.routeId).toBe("route-ui-7");
    expect(proposal.netId).toBe("net-ui-7");
    expect(proposal.edits).toEqual([
      {
        kind: "connect_endpoints",
        from: { kind: "port", portId: "in" },
        to: { kind: "port", portId: "out" },
        newNetId: "net-ui-7",
      },
      {
        kind: "set_route_points",
        routeId: "route-ui-7",
        netId: "net-ui-7",
        from: { kind: "port", portId: "in" },
        to: { kind: "port", portId: "out" },
        waypoints: [{ x: 40, y: 0 }],
        segmentModes: ["manual", "manual"],
      },
    ]);
  });

  it("orders anchor preludes before merging existing nets", () => {
    const from = createFreeWireAnchor({ x: 0, y: 0 }, "net-a", false, 3);
    const to = createFreeWireAnchor({ x: 40, y: 0 }, "net-b", false, 4);
    const proposal = proposeWireCommit(from, to, [], 5);

    expect(proposal.netId).toBe("net-a");
    expect(proposal.edits.map((edit) => edit.kind)).toEqual([
      "add_junction",
      "add_junction",
      "merge_nets",
      "connect_endpoints",
      "set_route_points",
    ]);
    expect(proposal.edits[2]).toEqual({
      kind: "merge_nets",
      targetNetId: "net-a",
      sourceNetId: "net-b",
    });
    expect(proposal.edits[3]).not.toHaveProperty("newNetId");
  });

  it("preserves the VDD source's supply presentation on its first rail", () => {
    const proposal = proposeWireCommit(
      source(
        { kind: "terminal", instanceId: "VDD1", pinName: "P" },
        { x: 0, y: 0 },
        "net-vdd",
        "power-rail",
      ),
      source({ kind: "port", portId: "rail-end" }, { x: 80, y: 0 }, "net-vdd"),
      [],
      11,
    );

    expect(proposal.edits.at(-1)).toMatchObject({
      kind: "set_route_points",
      presentation: "power-rail",
    });
  });

  it("creates free and route-tap anchors with stable IDs and snapped geometry", () => {
    expect(
      createFreeWireAnchor({ x: 12, y: 18 }, "net-new", true, 8),
    ).toMatchObject({
      endpoint: { kind: "junction", junctionId: "junction-ui-8" },
      netId: "net-new",
      point: { x: 12, y: 18 },
      preludeEdits: [{ createNet: true }],
    });

    const route = {
      id: "route-main",
      netId: "net-main",
      from: { kind: "port" as const, portId: "in" },
      to: { kind: "port" as const, portId: "out" },
      waypoints: [],
      segmentModes: ["manual" as const],
    };
    expect(
      createRouteWireAnchor(route, { x: 23.2, y: 37.8 }, 1, 10, 9),
    ).toEqual({
      endpoint: { kind: "junction", junctionId: "junction-ui-9" },
      netId: "net-main",
      point: { x: 20, y: 40 },
      preludeEdits: [
        {
          kind: "add_junction",
          junctionId: "junction-ui-9",
          netId: "net-main",
          position: { x: 20, y: 40 },
          split: {
            routeId: "route-main",
            firstRouteId: "route-main-a-9",
            secondRouteId: "route-main-b-9",
            segmentIndex: 1,
          },
        },
      ],
    });

    expect(
      createRouteWireAnchor(
        { ...route, presentation: "bulk-dashed" },
        { x: 23.2, y: 37.8 },
        1,
        10,
        10,
      ),
    ).toMatchObject({ routePresentation: "bulk-dashed" });

    // Splitting a VDD rail preserves its presentation on the two rail pieces,
    // but the newly drawn branch must use the ordinary wire presentation.
    expect(
      createRouteWireAnchor(
        { ...route, presentation: "power-rail" },
        { x: 23.2, y: 37.8 },
        1,
        10,
        11,
      ),
    ).not.toHaveProperty("routePresentation");
  });
});
