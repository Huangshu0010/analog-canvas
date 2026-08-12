import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createEmptyProject,
  parseProject,
  type CircuitProject,
} from "@icm/model";
import {
  InMemorySymbolResolver,
  builtInSymbols,
  createProjectSymbolResolver,
} from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { deriveFlightlines, endpointKey } from "./index.js";
import { buildProjectConnectivityIndex } from "./connectivity-index.js";

// Minimal two-pin symbol with known pin names L/R; used for the hierarchy test
// so a parent instance pin maps to a same-named child Document port.
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

function loadFixtureProject(name: string): CircuitProject {
  return parseProject(
    readFileSync(
      resolve(process.cwd(), `fixtures/projects/${name}/project.icproj.json`),
      "utf8",
    ),
  );
}

/**
 * Reduce a flightline to its partition-invariant canonical form: from/to
 * ordered by endpoint key, points carried with that order, distance kept.
 */
function canonicalFlightline(
  line: ReturnType<typeof deriveFlightlines>[number],
) {
  const swap =
    endpointKey(line.from).localeCompare(endpointKey(line.to), "en") > 0;
  const from = swap ? line.to : line.from;
  const to = swap ? line.from : line.to;
  const fromPoint = swap ? line.toPoint : line.fromPoint;
  const toPoint = swap ? line.fromPoint : line.toPoint;
  return {
    endpoints: `${endpointKey(from)}|${endpointKey(to)}`,
    distance: line.distance,
    fromPoint,
    toPoint,
  };
}

function sortFlightlines(
  lines: readonly ReturnType<typeof deriveFlightlines>[number][],
) {
  return lines
    .map(canonicalFlightline)
    .sort(
      (a, b) =>
        a.endpoints.localeCompare(b.endpoints, "en") || a.distance - b.distance,
    );
}

describe("ProjectConnectivityIndex", () => {
  describe("flightline parity with deriveFlightlines", () => {
    // The index wraps the existing derivation and normalizes direction/id
    // (ADR 0013). Content (endpoint pair + distance + points) must match the
    // raw derivation on every fixture.
    for (const fixture of [
      "phase-1-manual",
      "phase-2-imported-rlc",
      "phase-3-routing",
      "phase-5-dense-analog",
    ]) {
      it(`matches deriveFlightlines content on ${fixture}`, () => {
        const project = loadFixtureProject(fixture);
        const resolver = createProjectSymbolResolver(project, builtInSymbols);
        const index = buildProjectConnectivityIndex(project, resolver);

        for (const document of project.documents) {
          const docIndex = index.documents.get(document.id)!;
          const indexFlightlines = [...docIndex.nets.values()].flatMap(
            (net) => net.flightlines,
          );
          expect(sortFlightlines(indexFlightlines)).toEqual(
            sortFlightlines(deriveFlightlines(document, resolver)),
          );
        }
      });
    }
  });

  describe("flightline id normalization (ADR 0013, resolves WP-R0)", () => {
    function buildPartitionProject(
      partition: "single" | "split",
    ): CircuitProject {
      const project = createEmptyProject(
        `partition-${partition}`,
        "P",
        `partition-${partition}`,
      );
      const document = project.documents[0]!;
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
      } else {
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
      }
      return project;
    }

    it("produces one partition-invariant flightline id for single vs split storage", () => {
      const resolver = new InMemorySymbolResolver([]);
      const single = buildProjectConnectivityIndex(
        buildPartitionProject("single"),
        resolver,
      );
      const split = buildProjectConnectivityIndex(
        buildPartitionProject("split"),
        resolver,
      );
      const singleFlightlines = single.documents
        .get("partition-single")!
        .nets.get("net-signal")!.flightlines;
      const splitFlightlines = split.documents
        .get("partition-split")!
        .nets.get("net-signal")!.flightlines;
      expect(singleFlightlines).toHaveLength(1);
      expect(splitFlightlines).toHaveLength(1);
      // The WP-R0 finding was that raw deriveFlightlines gave different ids; the
      // index normalization makes them coincide.
      expect(splitFlightlines[0]!.id).toBe(singleFlightlines[0]!.id);
      expect(splitFlightlines[0]!.from).toEqual(singleFlightlines[0]!.from);
      expect(splitFlightlines[0]!.to).toEqual(singleFlightlines[0]!.to);
    });
  });

  describe("typed virtual edges and object index", () => {
    function labelFixtureProject(): CircuitProject {
      const project = createEmptyProject("labels", "Labels", "labels");
      const document = project.documents[0]!;
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
      ];
      document.nets = [
        {
          id: "net-signal",
          name: "signal",
          scope: "local",
          terminals: [],
          ports: ["port-left", "port-right"],
        },
      ];
      document.junctions = [
        {
          id: "junction-left",
          netId: "net-signal",
          position: { x: 40, y: 100 },
        },
        {
          id: "junction-right",
          netId: "net-signal",
          position: { x: 160, y: 100 },
        },
      ];
      const label = (id: string, attachedObjectId: string, text: string) => ({
        id,
        kind: "net-label" as const,
        text,
        position: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
        rotation: 0 as const,
        attachedObjectId,
        alignment: "start" as const,
        locked: false,
      });
      document.annotations = [
        label("label-left", "junction-left", "SIGNAL"),
        label("label-right", "junction-right", "SIGNAL"),
      ];
      return project;
    }

    it("exposes same-net label pairs as typed virtual edges", () => {
      const resolver = new InMemorySymbolResolver([]);
      const index = buildProjectConnectivityIndex(
        labelFixtureProject(),
        resolver,
      );
      const net = index.documents.get("labels")!.nets.get("net-signal")!;
      expect(net.virtualEdges).toEqual([
        {
          kind: "net-label",
          from: { kind: "junction", junctionId: "junction-left" },
          to: { kind: "junction", junctionId: "junction-right" },
          evidence: "SIGNAL",
        },
      ]);
    });

    it("resolves known objects and rejects unknown ones", () => {
      const project = labelFixtureProject();
      const index = buildProjectConnectivityIndex(
        project,
        new InMemorySymbolResolver([]),
      );
      expect(index.objectIndex.resolve("labels", "net-signal")).toEqual({
        documentId: "labels",
        kind: "net",
        objectId: "net-signal",
      });
      expect(index.objectIndex.resolve("labels", "junction-left")).toEqual({
        documentId: "labels",
        kind: "junction",
        objectId: "junction-left",
      });
      expect(
        index.objectIndex.resolve("labels", "no-such-object"),
      ).toBeUndefined();
      expect(index.objectIndex.resolve("no-such-doc", "x")).toBeUndefined();
    });

    it("maps endpointToNet across terminals, ports, and junctions", () => {
      const index = buildProjectConnectivityIndex(
        labelFixtureProject(),
        new InMemorySymbolResolver([]),
      );
      const endpointToNet = index.documents.get("labels")!.endpointToNet;
      expect(endpointToNet.get("port:port-left")).toBe("net-signal");
      expect(endpointToNet.get("port:port-right")).toBe("net-signal");
      expect(endpointToNet.get("junction:junction-left")).toBe("net-signal");
      expect(endpointToNet.get("junction:junction-right")).toBe("net-signal");
    });
  });

  describe("hierarchy edges", () => {
    function hierarchyProject(): CircuitProject {
      const project = createEmptyProject("hier", "Hier", "top");
      const top = project.documents[0]!;
      top.name = "top";
      top.instances = [
        {
          id: "X1",
          symbolId: "dual",
          placement: {
            position: { x: 100, y: 100 },
            rotation: 0,
            mirror: "none",
          },
          properties: { "spice.childDocumentId": "child" },
        },
      ];
      const childBase = createEmptyProject("child", "Child", "child")
        .documents[0]!;
      childBase.name = "child";
      childBase.ports = [
        {
          id: "port-l",
          name: "L",
          direction: "passive",
          position: { x: 0, y: 0 },
        },
        {
          id: "port-r",
          name: "R",
          direction: "passive",
          position: { x: 40, y: 0 },
        },
      ];
      project.documents.push(childBase);
      return project;
    }

    it("maps each parent pin to the same-named child port via spice.childDocumentId", () => {
      const resolver = new InMemorySymbolResolver([dual]);
      const index = buildProjectConnectivityIndex(hierarchyProject(), resolver);
      expect(index.hierarchy.edges).toEqual([
        {
          parentDocumentId: "top",
          instanceId: "X1",
          parentPinName: "L",
          childDocumentId: "child",
          childPortId: "port-l",
        },
        {
          parentDocumentId: "top",
          instanceId: "X1",
          parentPinName: "R",
          childDocumentId: "child",
          childPortId: "port-r",
        },
      ]);
    });
  });
});
