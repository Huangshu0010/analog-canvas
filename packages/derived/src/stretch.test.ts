import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  deriveInternalGroupSelection,
  proposeGroupMove,
  proposeGroupStretch,
  proposeWireSegmentDrag,
} from "./stretch.js";

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

  it("moves only the selected connected component of a shared logical Net", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.nets.push({
      id: "net-shared",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
        { instanceId: "R3", pinName: "1" },
      ],
      ports: [],
    });
    document.junctions.push({
      id: "junction-remote",
      netId: "net-shared",
      position: { x: 500, y: 100 },
    });
    document.routes.push(
      {
        id: "route-selected",
        netId: "net-shared",
        from: { kind: "terminal", instanceId: "R1", pinName: "2" },
        to: { kind: "terminal", instanceId: "R2", pinName: "1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-remote",
        netId: "net-shared",
        from: { kind: "terminal", instanceId: "R3", pinName: "1" },
        to: { kind: "junction", junctionId: "junction-remote" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    expect(deriveInternalGroupSelection(document, ["R1", "R2"])).toEqual({
      netIds: [],
      routeIds: ["route-selected"],
      junctionIds: [],
    });
  });

  it("keeps a shared junction fixed when its component reaches an unselected terminal", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.nets.push({
      id: "net-branch",
      scope: "local",
      terminals: [
        { instanceId: "R1", pinName: "2" },
        { instanceId: "R2", pinName: "1" },
      ],
      ports: [],
    });
    document.junctions.push({
      id: "junction-branch",
      netId: "net-branch",
      position: { x: 180, y: 100 },
    });
    document.routes.push(
      {
        id: "route-inside",
        netId: "net-branch",
        from: { kind: "terminal", instanceId: "R1", pinName: "2" },
        to: { kind: "junction", junctionId: "junction-branch" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-boundary",
        netId: "net-branch",
        from: { kind: "junction", junctionId: "junction-branch" },
        to: { kind: "terminal", instanceId: "R2", pinName: "1" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    expect(deriveInternalGroupSelection(document, ["R1"])).toEqual({
      netIds: [],
      routeIds: [],
      junctionIds: [],
    });
  });
});

describe("topology-aware wire segment drag", () => {
  function closedLoopDocument(splitAtTopRight: boolean) {
    const document = createEmptyDocument("document-loop", "Loop");
    document.ports.push(
      {
        id: "top-pin",
        name: "TOP",
        direction: "bidirectional",
        position: { x: 0, y: 0 },
      },
      {
        id: "bottom-pin",
        name: "BOTTOM",
        direction: "bidirectional",
        position: { x: 0, y: 100 },
      },
    );
    document.nets.push({
      id: "net-loop",
      scope: "local",
      terminals: [],
      ports: ["top-pin", "bottom-pin"],
    });
    if (!splitAtTopRight) {
      document.routes.push({
        id: "loop",
        netId: "net-loop",
        from: { kind: "port", portId: "bottom-pin" },
        to: { kind: "port", portId: "top-pin" },
        waypoints: [
          { x: 100, y: 100 },
          { x: 100, y: 0 },
        ],
        segmentModes: ["manual", "manual", "manual"],
      });
      return document;
    }
    document.junctions.push({
      id: "top-right",
      netId: "net-loop",
      position: { x: 100, y: 0 },
      role: "route-anchor",
    });
    document.routes.push(
      {
        id: "loop-side",
        netId: "net-loop",
        from: { kind: "port", portId: "bottom-pin" },
        to: { kind: "junction", junctionId: "top-right" },
        waypoints: [{ x: 100, y: 100 }],
        segmentModes: ["manual", "manual"],
      },
      {
        id: "loop-top",
        netId: "net-loop",
        from: { kind: "junction", junctionId: "top-right" },
        to: { kind: "port", portId: "top-pin" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );
    return document;
  }

  it("shrinks a split closed loop without leaving its route-anchor behind", () => {
    const document = closedLoopDocument(true);

    expect(
      proposeWireSegmentDrag(document, resolver, "loop-side", 1, {
        x: 60,
        y: 50,
      }),
    ).toEqual({
      junctions: [{ junctionId: "top-right", position: { x: 60, y: 0 } }],
      routes: [
        {
          routeId: "loop-side",
          waypoints: [{ x: 60, y: 100 }],
          segmentModes: ["manual", "manual"],
        },
        {
          routeId: "loop-top",
          waypoints: [],
          segmentModes: ["manual"],
        },
      ],
    });
  });

  it("is invariant to whether the same visible loop is one or two Routes", () => {
    const single = proposeWireSegmentDrag(
      closedLoopDocument(false),
      resolver,
      "loop",
      1,
      { x: 60, y: 50 },
    );
    const split = proposeWireSegmentDrag(
      closedLoopDocument(true),
      resolver,
      "loop-side",
      1,
      { x: 60, y: 50 },
    );

    expect(single).toEqual({
      junctions: [],
      routes: [
        {
          routeId: "loop",
          waypoints: [
            { x: 60, y: 100 },
            { x: 60, y: 0 },
          ],
          segmentModes: ["manual", "manual", "manual"],
        },
      ],
    });
    expect(split.junctions[0]!.position).toEqual(
      single.routes[0]!.waypoints[1],
    );
    expect(
      split.routes.find((route) => route.routeId === "loop-side")!.waypoints,
    ).toEqual([single.routes[0]!.waypoints[0]]);
  });

  it("moves a dangling route-anchor but keeps a real branch fixed", () => {
    const loose = closedLoopDocument(true);
    loose.routes.splice(1, 1);
    const looseProposal = proposeWireSegmentDrag(
      loose,
      resolver,
      "loop-side",
      1,
      { x: 70, y: 50 },
    );
    expect(looseProposal.junctions).toEqual([
      { junctionId: "top-right", position: { x: 70, y: 0 } },
    ]);

    const branch = closedLoopDocument(true);
    branch.ports.push({
      id: "branch-pin",
      name: "BRANCH",
      direction: "bidirectional",
      position: { x: 140, y: 0 },
    });
    branch.nets[0]!.ports.push("branch-pin");
    branch.routes.push({
      id: "loop-branch",
      netId: "net-loop",
      from: { kind: "junction", junctionId: "top-right" },
      to: { kind: "port", portId: "branch-pin" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    const branchProposal = proposeWireSegmentDrag(
      branch,
      resolver,
      "loop-side",
      1,
      { x: 70, y: 50 },
    );
    expect(branchProposal.junctions).toEqual([]);
    expect(branchProposal.routes).toEqual([
      {
        routeId: "loop-side",
        waypoints: [
          { x: 70, y: 100 },
          { x: 70, y: 0 },
        ],
        segmentModes: ["manual", "manual", "manual"],
      },
    ]);
  });

  it("rejects protected selected and incident geometry", () => {
    const selectedProtected = closedLoopDocument(true);
    selectedProtected.routes[0]!.segmentModes[1] = "locked";
    expect(() =>
      proposeWireSegmentDrag(selectedProtected, resolver, "loop-side", 1, {
        x: 60,
        y: 50,
      }),
    ).toThrow("protected");

    const incidentProtected = closedLoopDocument(true);
    incidentProtected.routes[1]!.segmentModes[0] = "trunk";
    expect(() =>
      proposeWireSegmentDrag(incidentProtected, resolver, "loop-side", 1, {
        x: 60,
        y: 50,
      }),
    ).toThrow("protected adjacent segment");
  });
});
