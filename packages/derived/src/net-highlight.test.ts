import { createEmptyProject, type CircuitProject } from "@icm/model";
import { InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { buildProjectConnectivityIndex } from "./connectivity-index.js";
import { endpointKey } from "./endpoint.js";
import {
  computeNetHighlight,
  traceHierarchyNet,
  traceNet,
} from "./net-highlight.js";

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

function localProject(): CircuitProject {
  const project = createEmptyProject("h", "H", "doc");
  const document = project.documents[0]!;
  document.ports = [
    { id: "p1", name: "a", direction: "passive", position: { x: 0, y: 0 } },
    { id: "p2", name: "b", direction: "passive", position: { x: 100, y: 0 } },
  ];
  document.nets = [
    {
      id: "net-x",
      name: "x",
      scope: "local",
      terminals: [],
      ports: ["p1", "p2"],
    },
  ];
  document.junctions = [
    { id: "j1", netId: "net-x", position: { x: 50, y: 0 } },
  ];
  document.routes = [
    {
      id: "r1",
      netId: "net-x",
      from: { kind: "port", portId: "p1" },
      to: { kind: "junction", junctionId: "j1" },
      waypoints: [],
      segmentModes: ["manual"],
    },
  ];
  return project;
}

function hierarchyProject(): CircuitProject {
  const project = createEmptyProject("hp", "HP", "top");
  const top = project.documents[0]!;
  top.instances = [
    {
      id: "X1",
      symbolId: "dual",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: { "spice.childDocumentId": "child" },
    },
  ];
  top.nets = [
    {
      id: "net-top",
      name: "top",
      scope: "local",
      terminals: [
        { instanceId: "X1", pinName: "L" },
        { instanceId: "X1", pinName: "R" },
      ],
      ports: [],
    },
  ];
  const child = createEmptyProject("c", "C", "child").documents[0]!;
  child.ports = [
    { id: "port-l", name: "L", direction: "passive", position: { x: 0, y: 0 } },
    {
      id: "port-r",
      name: "R",
      direction: "passive",
      position: { x: 40, y: 0 },
    },
  ];
  child.nets = [
    {
      id: "net-child-l",
      name: "childL",
      scope: "local",
      terminals: [],
      ports: ["port-l"],
    },
  ];
  project.documents.push(child);
  return project;
}

describe("net highlight and cross-cell trace", () => {
  it("aggregates the net's visible endpoints, routes, and junctions", () => {
    const index = buildProjectConnectivityIndex(
      localProject(),
      new InMemorySymbolResolver([]),
    );
    const highlight = computeNetHighlight(index, "doc", "net-x")!;
    expect(highlight.routes).toEqual(["r1"]);
    expect(highlight.junctions).toEqual(["j1"]);
    expect(highlight.visibleEndpoints.map((e) => e.kind).sort()).toEqual([
      "junction",
      "port",
      "port",
    ]);
  });

  it("returns undefined for an unknown document or net", () => {
    const index = buildProjectConnectivityIndex(
      localProject(),
      new InMemorySymbolResolver([]),
    );
    expect(computeNetHighlight(index, "doc", "missing")).toBeUndefined();
    expect(computeNetHighlight(index, "missing", "net-x")).toBeUndefined();
  });

  it("derives a seeded visible component from Label connectivity instead of raw Net membership", () => {
    const project = createEmptyProject("labels", "Labels", "doc");
    const document = project.documents[0]!;
    document.ports = [
      { id: "p1", name: "p1", direction: "passive", position: { x: 0, y: 0 } },
      {
        id: "p2",
        name: "p2",
        direction: "passive",
        position: { x: 100, y: 0 },
      },
      {
        id: "p3",
        name: "p3",
        direction: "passive",
        position: { x: 200, y: 0 },
      },
      {
        id: "p4",
        name: "p4",
        direction: "passive",
        position: { x: 300, y: 0 },
      },
    ];
    document.nets = [
      {
        id: "net-merged",
        scope: "local",
        terminals: [],
        ports: ["p1", "p2", "p3", "p4"],
      },
    ];
    document.routes = [
      {
        id: "route-left",
        netId: "net-merged",
        from: { kind: "port", portId: "p1" },
        to: { kind: "port", portId: "p2" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-right",
        netId: "net-merged",
        from: { kind: "port", portId: "p3" },
        to: { kind: "port", portId: "p4" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ];
    document.annotations = [
      {
        id: "label-left",
        kind: "net-label",
        content: { runs: [{ kind: "text", value: "SIGNAL" }] },
        netId: "net-merged",
        anchor: { kind: "free", position: { x: 50, y: -8 } },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
      {
        id: "label-right",
        kind: "net-label",
        content: { runs: [{ kind: "text", value: "SIGNAL" }] },
        netId: "net-merged",
        anchor: { kind: "free", position: { x: 250, y: -8 } },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
    ];
    const resolver = new InMemorySymbolResolver([]);
    const connected = computeNetHighlight(
      buildProjectConnectivityIndex(project, resolver),
      "doc",
      "net-merged",
      { kind: "port", portId: "p1" },
    )!;
    expect(connected.routes).toEqual(["route-left", "route-right"]);

    const withoutRightLabel = structuredClone(project);
    withoutRightLabel.documents[0]!.annotations = [
      withoutRightLabel.documents[0]!.annotations[0]!,
    ];
    const disconnected = computeNetHighlight(
      buildProjectConnectivityIndex(withoutRightLabel, resolver),
      "doc",
      "net-merged",
      { kind: "port", portId: "p1" },
    )!;
    expect(disconnected.routes).toEqual(["route-left"]);
    expect(
      disconnected.visibleEndpoints.map((endpoint) => endpointKey(endpoint)),
    ).toEqual(["port:p1", "port:p2"]);
  });

  it("traces parent pins on the net through hierarchy edges into child ports", () => {
    const index = buildProjectConnectivityIndex(
      hierarchyProject(),
      new InMemorySymbolResolver([dual]),
    );
    const trace = traceNet(index, "top", "net-top")!;
    expect(trace.crossCell).toEqual([
      {
        parentDocumentId: "top",
        instanceId: "X1",
        parentPinName: "L",
        childDocumentId: "child",
        childPortId: "port-l",
        childNetId: "net-child-l",
      },
      {
        parentDocumentId: "top",
        instanceId: "X1",
        parentPinName: "R",
        childDocumentId: "child",
        childPortId: "port-r",
        childNetId: undefined,
      },
    ]);
  });

  it("yields no cross-cell frames when the net has no hierarchy edge", () => {
    const index = buildProjectConnectivityIndex(
      localProject(),
      new InMemorySymbolResolver([]),
    );
    const trace = traceNet(index, "doc", "net-x")!;
    expect(trace.crossCell).toEqual([]);
  });

  it("traces hierarchy Nets downward and upward while retaining concrete instance hops", () => {
    const index = buildProjectConnectivityIndex(
      hierarchyProject(),
      new InMemorySymbolResolver([dual]),
    );
    const fromTop = traceHierarchyNet(index, "top", "net-top")!;
    expect(
      fromTop.highlights.map((item) => `${item.documentId}:${item.netId}`),
    ).toEqual(["child:net-child-l", "top:net-top"]);
    expect(fromTop.hops).toContainEqual(
      expect.objectContaining({
        direction: "down",
        from: { documentId: "top", netId: "net-top" },
        to: { documentId: "child", netId: "net-child-l" },
        frame: expect.objectContaining({
          instanceId: "X1",
          childPortId: "port-l",
        }),
      }),
    );

    const fromChild = traceHierarchyNet(index, "child", "net-child-l")!;
    expect(fromChild.hops).toContainEqual(
      expect.objectContaining({
        direction: "up",
        from: { documentId: "child", netId: "net-child-l" },
        to: { documentId: "top", netId: "net-top" },
      }),
    );
  });
});
