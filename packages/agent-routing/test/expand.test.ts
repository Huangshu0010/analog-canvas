import { describe, expect, it } from "vitest";
import { expandRouteTree } from "../src/index.js";
import type { RouteTreeDecision, ResolvedEndpoint } from "../src/index.js";
import type { RouteEndpoint } from "@icm/model";

function endpoint(
  id: string,
  x: number,
  y: number,
  endpoint: RouteEndpoint,
): ResolvedEndpoint {
  return {
    id,
    endpoint,
    point: { x, y },
    outward: endpoint.kind === "terminal" ? { x: 0, y: -1 } : null,
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

const baseDecision = (
  overrides: Partial<RouteTreeDecision>,
): RouteTreeDecision => ({
  documentId: "doc",
  revision: 0,
  netId: "net-1",
  shape: "direct",
  endpointGroups: [],
  ...overrides,
});

describe("expandRouteTree", () => {
  it("produces deterministic edits for a direct two-endpoint group", () => {
    const decision = baseDecision({
      shape: "direct",
      endpointGroups: [{ id: "g1", endpointIds: ["a", "b"], attachTo: "net" }],
    });
    const result = expandRouteTree(
      decision,
      input([term("a", 100, 200, "M1", "D"), term("b", 200, 200, "M2", "S")]),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]!.kind).toBe("route_orthogonal");
    expect(result.metrics.routeCount).toBe(1);
    expect(result.resolvedGeometry[0]!.points).toEqual([
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ]);
  });

  it("rejects a direct group that does not have exactly two endpoints", () => {
    const decision = baseDecision({
      shape: "direct",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "b", "c"], attachTo: "net" },
      ],
    });
    const result = expandRouteTree(
      decision,
      input([
        term("a", 100, 200, "M1", "D"),
        term("b", 200, 200, "M2", "S"),
        term("c", 300, 200, "M3", "S"),
      ]),
    );
    expect(result.edits).toEqual([]);
    expect(result.conflicts[0]!.code).toBe("SHAPE_MISMATCH");
  });

  it("returns MISSING_ENDPOINT when a referenced endpoint is absent", () => {
    const decision = baseDecision({
      shape: "direct",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "ghost"], attachTo: "net" },
      ],
    });
    const result = expandRouteTree(
      decision,
      input([term("a", 100, 200, "M1", "D")]),
    );
    expect(result.edits).toEqual([]);
    expect(result.conflicts[0]!.code).toBe("MISSING_ENDPOINT");
    expect(result.conflicts[0]!.objectIds).toContain("ghost");
  });

  it("rejects an unknown shape instead of falling back", () => {
    const decision = baseDecision({
      shape: "auto" as RouteTreeDecision["shape"],
    });
    const result = expandRouteTree(decision, input([]));
    expect(result.edits).toEqual([]);
    expect(result.conflicts[0]!.code).toBe("UNKNOWN_SHAPE");
  });

  it("builds a branch junction for local-branch-tree and links groups", () => {
    const decision = baseDecision({
      shape: "local-branch-tree",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "b"], attachTo: "g2" },
        { id: "g2", endpointIds: ["c", "d"], attachTo: "g1" },
      ],
    });
    const result = expandRouteTree(
      decision,
      input([
        term("a", 100, 200, "M1", "D"),
        term("b", 100, 240, "M1", "S"),
        term("c", 300, 200, "M2", "D"),
        term("d", 300, 240, "M2", "S"),
      ]),
    );
    expect(result.conflicts).toEqual([]);
    // 2 escape routes per group (4) + 1 inter-group link (g1->g2 deduped
    // against g2->g1) = 5 routes; 2 junctions.
    expect(result.metrics.routeCount).toBe(5);
    expect(result.metrics.junctionCount).toBe(2);
    // Junction positions are snapped to the 10-unit grid.
    for (const edit of result.edits) {
      if (edit.kind === "add_junction") {
        expect(edit.position.x % 10).toBe(0);
        expect(edit.position.y % 10).toBe(0);
      }
    }
  });

  it("reports TRUNK_CORRIDOR_BLOCKED instead of rerouting when a trunk crosses an instance", () => {
    const decision = baseDecision({
      shape: "shared-trunk",
      endpointGroups: [{ id: "g1", endpointIds: ["a", "b"], attachTo: "net" }],
    });
    // Endpoints span x 100..300, median y ~ 200; place an instance box on y=200.
    const result = expandRouteTree(decision, {
      endpoints: new Map([
        [term("a", 100, 200, "M1", "D").id, term("a", 100, 200, "M1", "D")],
        [term("b", 300, 200, "M2", "S").id, term("b", 300, 200, "M2", "S")],
      ]),
      existingRoutePolylines: [],
      instanceBoxes: [
        { instanceId: "M3", min: { x: 180, y: 190 }, max: { x: 220, y: 210 } },
      ],
    });
    expect(
      result.conflicts.some((c) => c.code === "TRUNK_CORRIDOR_BLOCKED"),
    ).toBe(true);
    // Still emits edits (the trunk and escapes); the conflict is advisory.
    expect(result.metrics.routeCount).toBeGreaterThan(0);
  });

  it("labeled-islands emits per-group junctions and no inter-group routes", () => {
    const decision = baseDecision({
      shape: "labeled-islands",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "b"], attachTo: "g2" },
        { id: "g2", endpointIds: ["c", "d"], attachTo: "g1" },
      ],
    });
    const result = expandRouteTree(
      decision,
      input([
        term("a", 100, 200, "M1", "D"),
        term("b", 100, 240, "M1", "S"),
        term("c", 500, 200, "M2", "D"),
        term("d", 500, 240, "M2", "S"),
      ]),
    );
    expect(result.conflicts).toEqual([]);
    // 2 escape routes per group = 4 routes; 2 junctions; NO inter-group link.
    expect(result.metrics.routeCount).toBe(4);
    expect(result.metrics.junctionCount).toBe(2);
  });

  it("is deterministic: same decision + input yields identical output", () => {
    const decision = baseDecision({
      shape: "local-branch-tree",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "b"], attachTo: "g2" },
        { id: "g2", endpointIds: ["c", "d"], attachTo: "g1" },
      ],
    });
    const inp = input([
      term("a", 100, 200, "M1", "D"),
      term("b", 100, 240, "M1", "S"),
      term("c", 300, 200, "M2", "D"),
      term("d", 300, 240, "M2", "S"),
    ]);
    const first = expandRouteTree(decision, inp);
    const second = expandRouteTree(decision, inp);
    expect(second).toEqual(first);
  });

  it("shared-trunk attaches each escape to a distinct tap Junction, not a trunk-end", () => {
    const decision = baseDecision({
      shape: "shared-trunk",
      endpointGroups: [
        { id: "g1", endpointIds: ["a", "b", "c"], attachTo: "net" },
      ],
    });
    const result = expandRouteTree(
      decision,
      input([
        term("a", 100, 200, "M1", "D"),
        term("b", 300, 200, "M2", "D"),
        term("c", 500, 200, "M3", "D"),
      ]),
    );
    expect(result.conflicts).toEqual([]);
    // Each escape route connects endpoint -> a tap junction whose x equals the
    // endpoint's snapped x (not a shared trunk-end junction). Three escapes
    // must attach to three distinct junction ids.
    const escapeRoutes = result.edits.filter(
      (e) => e.kind === "route_orthogonal",
    );
    expect(escapeRoutes).toHaveLength(3);
    const tapTargets = new Set(
      escapeRoutes.map((e) =>
        e.kind === "route_orthogonal" && e.to.kind === "junction"
          ? e.to.junctionId
          : null,
      ),
    );
    expect(tapTargets.size).toBe(3);
    // resolvedGeometry endpoints land at each endpoint's snapped x on the trunk.
    const escapeGeo = result.resolvedGeometry.filter((g) =>
      escapeRoutes.some(
        (e) => e.kind === "route_orthogonal" && e.routeId === g.routeId,
      ),
    );
    expect(escapeGeo).toHaveLength(3);
    for (const geo of escapeGeo) {
      const last = geo.points[geo.points.length - 1]!;
      expect(last.y).toBe(200);
      expect(last.x % 10).toBe(0);
    }
  });
});
