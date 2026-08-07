import { describe, expect, it } from "vitest";
import { expandRouteGraph } from "../src/index.js";
import type { RouteGraph, ResolvedEndpoint } from "../src/index.js";
import type { RouteEndpoint, Point } from "@icm/model";

function endpoint(
  id: string,
  x: number,
  y: number,
  ep: RouteEndpoint,
): ResolvedEndpoint {
  return {
    id,
    endpoint: ep,
    point: { x, y },
    outward: ep.kind === "terminal" ? { x: 0, y: -1 } : null,
  };
}

function input(endpoints: ResolvedEndpoint[]) {
  return {
    endpoints: new Map(endpoints.map((e) => [e.id, e])),
    existingRoutePolylines: [],
    instanceBoxes: [],
  };
}

const term = (
  id: string,
  x: number,
  y: number,
  instanceId: string,
  pinName: string,
): ResolvedEndpoint =>
  endpoint(id, x, y, { kind: "terminal", instanceId, pinName });

const baseGraph = (overrides: Partial<RouteGraph>): RouteGraph => ({
  documentId: "doc",
  revision: 0,
  netId: "net-1",
  nodes: [],
  edges: [],
  ...overrides,
});

describe("expandRouteGraph", () => {
  it("emits one escape edge for a direct endpoint-to-tap graph", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        { id: "tap0", role: "tap", at: { x: 200, y: 200 } },
      ],
      edges: [{ id: "e0", from: "a", to: "tap0", role: "escape" }],
    });
    const result = expandRouteGraph(
      graph,
      input([term("a", 100, 200, "M1", "D")]),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.edits).toHaveLength(2);
    expect(result.edits[0]!.kind).toBe("add_junction");
    expect(result.edits[1]!.kind).toBe("route_orthogonal");
    expect(result.metrics.routeCount).toBe(1);
    expect(result.metrics.junctionCount).toBe(1);
  });

  it("snaps tap positions to the 10-unit grid", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        { id: "tap0", role: "tap", at: { x: 207, y: 213 } },
      ],
      edges: [{ id: "e0", from: "a", to: "tap0", role: "escape" }],
    });
    const result = expandRouteGraph(
      graph,
      input([term("a", 100, 200, "M1", "D")]),
    );
    expect(result.conflicts).toEqual([]);
    const junction = result.edits.find((e) => e.kind === "add_junction")!;
    if (junction.kind !== "add_junction") return;
    expect(junction.position.x % 10).toBe(0);
    expect(junction.position.y % 10).toBe(0);
  });

  it("resolves a tap aligned with an endpoint on the y axis (vertical trunk)", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        { id: "tap0", role: "tap", alignWith: "a", axis: "y", offset: 100 },
      ],
      edges: [{ id: "e0", from: "a", to: "tap0", role: "escape" }],
    });
    const result = expandRouteGraph(
      graph,
      input([term("a", 100, 200, "M1", "D")]),
    );
    expect(result.conflicts).toEqual([]);
    const junction = result.edits.find((e) => e.kind === "add_junction")!;
    if (junction.kind !== "add_junction") return;
    expect(junction.position).toEqual({ x: 200, y: 200 });
  });

  it("emits a trunk edge between two taps as set_route_points with trunk mode", () => {
    const graph = baseGraph({
      nodes: [
        { id: "tap0", role: "tap", at: { x: 200, y: 100 } },
        { id: "tap1", role: "tap", at: { x: 200, y: 300 } },
      ],
      edges: [{ id: "trunk0", from: "tap0", to: "tap1", role: "trunk" }],
    });
    const result = expandRouteGraph(graph, input([]));
    expect(result.conflicts).toEqual([]);
    const route = result.edits.find((e) => e.kind === "set_route_points")!;
    if (route.kind !== "set_route_points") return;
    expect(route.segmentModes).toEqual(["trunk"]);
    expect(route.from).toEqual({ kind: "junction", junctionId: "tap0" });
    expect(route.to).toEqual({ kind: "junction", junctionId: "tap1" });
  });

  it("emits a label edge as a net-label annotation", () => {
    const graph = baseGraph({
      nodes: [{ id: "tap0", role: "tap", at: { x: 200, y: 200 } }],
      edges: [
        {
          id: "lbl0",
          from: "tap0",
          to: "tap0",
          role: "label",
          label: { text: "VOUT", attachedObjectId: "port-vout" },
        },
      ],
    });
    const result = expandRouteGraph(graph, input([]));
    expect(result.conflicts).toEqual([]);
    const ann = result.edits.find((e) => e.kind === "upsert_annotation")!;
    if (ann.kind !== "upsert_annotation") return;
    expect(ann.annotation.kind).toBe("net-label");
    expect(ann.annotation.text).toBe("VOUT");
  });

  it("returns MISSING_ENDPOINT when an endpoint node is absent from the input", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "ghost",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "MX", pinName: "D" },
        },
        { id: "tap0", role: "tap", at: { x: 200, y: 200 } },
      ],
      edges: [{ id: "e0", from: "ghost", to: "tap0", role: "escape" }],
    });
    const result = expandRouteGraph(graph, input([]));
    expect(result.conflicts.some((c) => c.code === "MISSING_ENDPOINT")).toBe(
      true,
    );
  });

  it("returns MISSING_NODE_POSITION when a tap has no at/alignWith (no median guess)", () => {
    const graph = baseGraph({
      nodes: [{ id: "tap0", role: "tap" }],
      edges: [],
    });
    const result = expandRouteGraph(graph, input([]));
    expect(
      result.conflicts.some((c) => c.code === "MISSING_NODE_POSITION"),
    ).toBe(true);
    expect(result.metrics.junctionCount).toBe(0);
  });

  it("returns ESCAPE_MALFORMED when an escape edge connects two endpoints", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        {
          id: "b",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M2", pinName: "S" },
        },
      ],
      edges: [{ id: "e0", from: "a", to: "b", role: "escape" }],
    });
    const result = expandRouteGraph(
      graph,
      input([term("a", 100, 200, "M1", "D"), term("b", 200, 200, "M2", "S")]),
    );
    expect(result.conflicts.some((c) => c.code === "ESCAPE_MALFORMED")).toBe(
      true,
    );
  });

  it("resolves alignWith transitively (tap aligns with another tap)", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        { id: "tap0", role: "tap", alignWith: "a", axis: "y", offset: 100 },
        { id: "tap1", role: "tap", alignWith: "tap0", axis: "x", offset: 50 },
      ],
      edges: [
        { id: "e0", from: "a", to: "tap0", role: "escape" },
        { id: "t0", from: "tap0", to: "tap1", role: "trunk" },
      ],
    });
    const result = expandRouteGraph(
      graph,
      input([term("a", 100, 200, "M1", "D")]),
    );
    expect(result.conflicts).toEqual([]);
    const junctions = result.edits.filter((e) => e.kind === "add_junction");
    expect(junctions).toHaveLength(2);
    const tap1 = junctions.find(
      (e): e is Extract<typeof e, { kind: "add_junction" }> =>
        e.kind === "add_junction" && e.junctionId === "tap1",
    )!;
    expect(tap1.position).toEqual({ x: 200, y: 250 });
  });

  it("is deterministic: same graph + input yields identical output", () => {
    const graph = baseGraph({
      nodes: [
        {
          id: "a",
          role: "endpoint",
          endpoint: { kind: "terminal", instanceId: "M1", pinName: "D" },
        },
        { id: "tap0", role: "tap", alignWith: "a", axis: "y", offset: 100 },
      ],
      edges: [{ id: "e0", from: "a", to: "tap0", role: "escape" }],
    });
    const inp = input([term("a", 100, 200, "M1", "D")]);
    const first = expandRouteGraph(graph, inp);
    const second = expandRouteGraph(graph, inp);
    expect(second).toEqual(first);
  });
});

void (null as unknown as Point);
