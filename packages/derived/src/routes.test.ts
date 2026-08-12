import { createEmptyProject } from "@icm/model";
import type { RouteBranch, SchematicDocument } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  deriveCrossings,
  deriveFlightlines,
  endpointKey,
  routePolyline,
} from "./index.js";

// Endpoint characterization does not depend on symbol geometry, so an empty
// resolver is sufficient for route/flightline/crossing primitives.
const resolver = new InMemorySymbolResolver([]);

function emptyDocument(id: string): SchematicDocument {
  return createEmptyProject(id, id).documents[0]!;
}

describe("route read-side geometry primitives", () => {
  describe("routePolyline", () => {
    it("concatenates from, waypoints, and to with the stored segment modes", () => {
      const document = emptyDocument("route-polyline");
      document.junctions = [
        { id: "j1", netId: "n", position: { x: 0, y: 0 } },
        { id: "j2", netId: "n", position: { x: 100, y: 100 } },
      ];
      const route: RouteBranch = {
        id: "route-w",
        netId: "n",
        from: { kind: "junction" as const, junctionId: "j1" },
        to: { kind: "junction" as const, junctionId: "j2" },
        waypoints: [{ x: 50, y: 0 }],
        segmentModes: ["manual", "auto"],
      };

      expect(routePolyline(document, resolver, route)).toEqual({
        routeId: "route-w",
        netId: "n",
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 100 },
        ],
        segmentModes: ["manual", "auto"],
      });
    });

    it("returns null when either endpoint cannot be resolved", () => {
      const document = emptyDocument("route-polyline-null");
      document.junctions = [
        { id: "j2", netId: "n", position: { x: 100, y: 100 } },
      ];
      const route: RouteBranch = {
        id: "route-x",
        netId: "n",
        from: { kind: "junction" as const, junctionId: "missing" },
        to: { kind: "junction" as const, junctionId: "j2" },
        waypoints: [],
        segmentModes: ["manual"],
      };
      expect(routePolyline(document, resolver, route)).toBeNull();
    });
  });

  describe("deriveCrossings", () => {
    it("reports collinear same-line overlaps with kind 'overlap'", () => {
      const document = emptyDocument("route-overlap");
      document.junctions = [
        { id: "j1", netId: "net-a", position: { x: 0, y: 0 } },
        { id: "j2", netId: "net-a", position: { x: 100, y: 0 } },
        { id: "j3", netId: "net-b", position: { x: 50, y: 0 } },
        { id: "j4", netId: "net-b", position: { x: 150, y: 0 } },
      ];
      document.routes = [
        {
          id: "route-a",
          netId: "net-a",
          from: { kind: "junction", junctionId: "j1" },
          to: { kind: "junction", junctionId: "j2" },
          waypoints: [],
          segmentModes: ["manual"],
        },
        {
          id: "route-b",
          netId: "net-b",
          from: { kind: "junction", junctionId: "j3" },
          to: { kind: "junction", junctionId: "j4" },
          waypoints: [],
          segmentModes: ["manual"],
        },
      ];

      expect(deriveCrossings(document, resolver)).toEqual([
        {
          routeAId: "route-a",
          routeBId: "route-b",
          netAId: "net-a",
          netBId: "net-b",
          point: { x: 50, y: 0 },
          kind: "overlap",
        },
      ]);
    });

    it("suppresses the intersection that coincides with a shared explicit endpoint", () => {
      const document = emptyDocument("route-shared");
      document.junctions = [
        { id: "shared", netId: "net-a", position: { x: 100, y: 100 } },
        { id: "end1", netId: "net-a", position: { x: 0, y: 100 } },
        { id: "end2", netId: "net-a", position: { x: 100, y: 0 } },
      ];
      document.routes = [
        {
          id: "route-a",
          netId: "net-a",
          from: { kind: "junction", junctionId: "shared" },
          to: { kind: "junction", junctionId: "end1" },
          waypoints: [],
          segmentModes: ["manual"],
        },
        {
          id: "route-b",
          netId: "net-a",
          from: { kind: "junction", junctionId: "shared" },
          to: { kind: "junction", junctionId: "end2" },
          waypoints: [],
          segmentModes: ["manual"],
        },
      ];
      // The two routes meet geometrically at {100,100}, but that point is their
      // shared explicit junction, so no crossing is emitted.
      expect(deriveCrossings(document, resolver)).toEqual([]);
    });
  });

  describe("storage partition invariance", () => {
    // The same visible wire is stored once as a single Route and once split at
    // a degree-2 route-anchor junction into two Routes. Derived read models
    // must be invariant to that storage partition.
    function buildPartition(partition: "single" | "split"): SchematicDocument {
      const document = emptyDocument(`partition-${partition}`);
      document.ports = [
        {
          id: "port-left",
          name: "left",
          direction: "passive",
          position: { x: 0, y: 100 },
        },
        {
          id: "port-right",
          name: "right",
          direction: "passive",
          position: { x: 200, y: 100 },
        },
        {
          id: "port-far",
          name: "far",
          direction: "passive",
          position: { x: 300, y: 300 },
        },
      ];
      document.nets = [
        {
          id: "net-signal",
          name: "signal",
          scope: "local",
          terminals: [],
          ports: ["port-left", "port-right", "port-far"],
        },
      ];

      if (partition === "single") {
        document.routes = [
          {
            id: "route-single",
            netId: "net-signal",
            from: { kind: "port", portId: "port-left" },
            to: { kind: "port", portId: "port-right" },
            waypoints: [],
            segmentModes: ["manual"],
          },
        ];
        return document;
      }

      document.junctions = [
        {
          id: "junction-anchor",
          netId: "net-signal",
          position: { x: 100, y: 100 },
          role: "route-anchor",
        },
      ];
      document.routes = [
        {
          id: "route-a",
          netId: "net-signal",
          from: { kind: "port", portId: "port-left" },
          to: { kind: "junction", junctionId: "junction-anchor" },
          waypoints: [],
          segmentModes: ["manual"],
        },
        {
          id: "route-b",
          netId: "net-signal",
          from: { kind: "junction", junctionId: "junction-anchor" },
          to: { kind: "port", portId: "port-right" },
          waypoints: [],
          segmentModes: ["manual"],
        },
      ];
      return document;
    }

    it("derives a flightline to the unrouted port that is endpoint-invariant across partitions", () => {
      // port-right is the uniquely nearest routed node to the unrouted
      // port-far in both partitions, so the flightline connects the same two
      // ports over the same distance either way.
      const single = deriveFlightlines(buildPartition("single"), resolver);
      const split = deriveFlightlines(buildPartition("split"), resolver);
      expect(single).toHaveLength(1);
      expect(split).toHaveLength(1);
      expect(single[0]!.distance).toBeCloseTo(
        Math.hypot(100, 200), // port-right {200,100} -> port-far {300,300}
      );
      expect(split[0]!.distance).toBe(single[0]!.distance);
      expect([single[0]!.from, single[0]!.to].map(endpointKey).sort()).toEqual([
        "port:port-far",
        "port:port-right",
      ]);
      expect([split[0]!.from, split[0]!.to].map(endpointKey).sort()).toEqual([
        "port:port-far",
        "port:port-right",
      ]);
    });

    it("pins the current from/to direction per partition (partition-sensitive id)", () => {
      // Characterization, not an ideal: the current deriveFlightlines orders
      // the component pair by each component's first-node key. Introducing a
      // route-anchor junction whose key sorts before the port keys flips the
      // pair order, which swaps from/to and therefore the derived flightline
      // id. The endpoints and distance coincide, but the direction is NOT
      // partition-invariant today. R2's ProjectConnectivityIndex must revisit
      // this consciously (preserve or deliberately normalize).
      const single = deriveFlightlines(buildPartition("single"), resolver);
      const split = deriveFlightlines(buildPartition("split"), resolver);
      expect(single[0]).toMatchObject({
        netId: "net-signal",
        from: { kind: "port", portId: "port-far" },
        to: { kind: "port", portId: "port-right" },
      });
      expect(split[0]).toMatchObject({
        netId: "net-signal",
        from: { kind: "port", portId: "port-right" },
        to: { kind: "port", portId: "port-far" },
      });
      // The asymmetric id derivation reflects the direction difference.
      expect(single[0]!.id).not.toBe(split[0]!.id);
    });

    it("does not invent a crossing at an explicit route-anchor join", () => {
      // The split partition's two routes share the anchor as an explicit
      // endpoint; that join is connectivity, not a crossing.
      expect(deriveCrossings(buildPartition("split"), resolver)).toEqual([]);
      expect(deriveCrossings(buildPartition("single"), resolver)).toEqual([]);
    });
  });
});
