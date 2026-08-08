import { describe, expect, it } from "vitest";

import type { SchematicDocument, VisualAnchor } from "@icm/model";

import { resolveVisualAnchor } from "./anchor.js";

// Minimal SymbolResolver stub: anchor resolution for object/free anchors never
// needs symbol geometry, and the route case uses a trivial orthogonal route
// whose endpoints are a junction + port (no symbol resolution required).
const stubResolver = {
  resolve: () => null,
} as unknown as Parameters<typeof resolveVisualAnchor>[1];

function documentWithRoute(): SchematicDocument {
  return {
    id: "doc",
    name: "Doc",
    revision: 0,
    sourceStatus: "in-sync",
    ports: [{ id: "port-out", name: "OUT", direction: "output", position: { x: 200, y: 100 } }],
    instances: [
      { id: "M1", symbolId: "nmos", symbolVariantId: "v", properties: {}, placement: { position: { x: 100, y: 100 }, rotation: 0, mirror: "none" } },
    ],
    nets: [{ id: "n1", scope: "local", terminals: [], ports: ["port-out"] }],
    routes: [
      {
        id: "r1",
        netId: "n1",
        from: { kind: "junction", junctionId: "j1" },
        to: { kind: "port", portId: "port-out" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    ],
    junctions: [{ id: "j1", netId: "n1", position: { x: 100, y: 100 } }],
    annotations: [],
    presentation: { styleProfileId: "razavi-textbook-v1", grid: 10, compactness: "normal" },
    layoutGroups: [],
    constraints: [],
    drafting: { objects: [], guides: [] },
  };
}

describe("resolveVisualAnchor", () => {
  it("resolves a free anchor to its own position", () => {
    const anchor: VisualAnchor = { kind: "free", position: { x: 50, y: 60 } };
    const resolved = resolveVisualAnchor(documentWithRoute(), stubResolver, anchor);
    expect(resolved).toEqual({ position: { x: 50, y: 60 }, rotation: 0, resolved: true });
  });

  it("resolves an object anchor to the target placement plus localOffset", () => {
    const anchor: VisualAnchor = {
      kind: "object",
      objectId: "M1",
      localOffset: { x: 10, y: 0 },
      fallbackPosition: { x: 0, y: 0 },
    };
    const resolved = resolveVisualAnchor(documentWithRoute(), stubResolver, anchor);
    expect(resolved.resolved).toBe(true);
    expect(resolved.position).toEqual({ x: 110, y: 100 });
  });

  it("returns fallback + diagnostic when the object target is missing", () => {
    const anchor: VisualAnchor = {
      kind: "object",
      objectId: "gone",
      localOffset: { x: 0, y: 0 },
      fallbackPosition: { x: 7, y: 8 },
    };
    const resolved = resolveVisualAnchor(documentWithRoute(), stubResolver, anchor);
    expect(resolved.resolved).toBe(false);
    expect(resolved.position).toEqual({ x: 7, y: 8 });
    expect(resolved.diagnostic?.code).toBe("anchor-target-missing");
  });

  it("resolves a route anchor along the segment using the legacy math", () => {
    const anchor: VisualAnchor = {
      kind: "route",
      routeId: "r1",
      segmentIndex: 0,
      t: 0.5,
      normalOffset: 0,
      direction: "forward",
      orientation: "follow",
      fallbackPosition: { x: 0, y: 0 },
    };
    const resolved = resolveVisualAnchor(documentWithRoute(), stubResolver, anchor);
    expect(resolved.resolved).toBe(true);
    // Midpoint of (100,100)-(200,100), normalOffset 0.
    expect(resolved.position).toEqual({ x: 150, y: 100 });
  });

  it("returns fallback + diagnostic when the route is deleted", () => {
    const anchor: VisualAnchor = {
      kind: "route",
      routeId: "missing",
      segmentIndex: 0,
      t: 0.5,
      normalOffset: 0,
      direction: "forward",
      orientation: "follow",
      fallbackPosition: { x: 9, y: 9 },
    };
    const resolved = resolveVisualAnchor(documentWithRoute(), stubResolver, anchor);
    expect(resolved.resolved).toBe(false);
    expect(resolved.position).toEqual({ x: 9, y: 9 });
    expect(resolved.diagnostic?.code).toBe("anchor-target-missing");
  });
});
