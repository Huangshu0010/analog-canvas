import { describe, expect, it } from "vitest";

import type { DraftingObject, SchematicDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

import { resolveDraftingObjectGeometry } from "./drafting-geometry.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function documentWithRoute(): SchematicDocument {
  return {
    id: "doc",
    name: "Doc",
    revision: 0,
    sourceStatus: "in-sync",
    ports: [
      {
        id: "port-out",
        name: "OUT",
        direction: "output",
        position: { x: 200, y: 100 },
      },
    ],
    instances: [
      {
        id: "M1",
        symbolId: "nmos",
        symbolVariantId: "textbook-3terminal",
        properties: {},
        placement: {
          position: { x: 100, y: 100 },
          rotation: 0,
          mirror: "none",
        },
      },
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
    presentation: {
      styleProfileId: "razavi-textbook-v1",
      grid: 10,
      compactness: "normal",
    },
    layoutGroups: [],
    constraints: [],
    drafting: { objects: [], guides: [] },
  };
}

function textObject(
  overrides: Partial<Extract<DraftingObject, { kind: "text" }>> = {},
): Extract<DraftingObject, { kind: "text" }> {
  return {
    id: "t1",
    kind: "text",
    locked: false,
    zIndex: 0,
    anchor: { kind: "free", position: { x: 50, y: 50 } },
    content: { runs: [{ kind: "text", value: "note" }] },
    alignment: "middle",
    rotation: 0,
    ...overrides,
  };
}

describe("resolveDraftingObjectGeometry (WP-R1)", () => {
  it("resolves a free-anchored text to its position with bounds", () => {
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      textObject(),
    );
    expect(geometry.kind).toBe("text");
    if (geometry.kind !== "text") return;
    expect(geometry.position).toEqual({ x: 50, y: 50 });
    expect(geometry.bounds.width).toBeGreaterThan(0);
    expect(geometry.diagnostics).toEqual([]);
  });

  it("follows an object anchor when the instance moves", () => {
    const document = documentWithRoute();
    const object = textObject({
      anchor: {
        kind: "object",
        objectId: "M1",
        localOffset: { x: 10, y: 0 },
        fallbackPosition: { x: 0, y: 0 },
      },
    });
    const before = resolveDraftingObjectGeometry(document, resolver, object);
    document.instances[0]!.placement!.position = { x: 300, y: 200 };
    const after = resolveDraftingObjectGeometry(document, resolver, object);
    expect(before.kind).toBe("text");
    expect(after.kind).toBe("text");
    if (before.kind !== "text" || after.kind !== "text") return;
    // M1 moved by (+200,+100); the text follows by the same delta.
    expect(after.position).toEqual({
      x: before.position.x + 200,
      y: before.position.y + 100,
    });
    expect(after.diagnostics).toEqual([]);
  });

  it("uses fallback and emits a diagnostic when the object target is missing", () => {
    const document = documentWithRoute();
    const object = textObject({
      anchor: {
        kind: "object",
        objectId: "gone",
        localOffset: { x: 0, y: 0 },
        fallbackPosition: { x: 7, y: 8 },
      },
    });
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    expect(geometry.kind).toBe("text");
    if (geometry.kind !== "text") return;
    expect(geometry.position).toEqual({ x: 7, y: 8 });
    expect(geometry.diagnostics[0]?.code).toBe(
      "DRAFTING_ANCHOR_TARGET_MISSING",
    );
    expect(geometry.diagnostics[0]?.anchorRole).toBe("anchor");
  });

  it("follows a route anchor and reports an invalid segment without guessing", () => {
    const document = documentWithRoute();
    const object = textObject({
      anchor: {
        kind: "route",
        routeId: "r1",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: 0,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 0, y: 0 },
      },
    });
    const before = resolveDraftingObjectGeometry(document, resolver, object);
    // Route stretches: endpoint port moves.
    document.ports[0]!.position = { x: 400, y: 100 };
    const after = resolveDraftingObjectGeometry(document, resolver, object);
    if (before.kind !== "text" || after.kind !== "text") return;
    expect(after.position.x).toBeGreaterThan(before.position.x);
    expect(after.diagnostics).toEqual([]);

    // Deleting the route yields fallback + a diagnostic (no new route guessed).
    document.routes = [];
    const invalid = resolveDraftingObjectGeometry(document, resolver, object);
    if (invalid.kind !== "text") return;
    expect(invalid.position).toEqual({ x: 0, y: 0 });
    expect(invalid.diagnostics[0]?.code).toBe("DRAFTING_ANCHOR_TARGET_MISSING");
  });

  it("resolves an arrow with both endpoints anchored independently", () => {
    const document = documentWithRoute();
    const object: Extract<DraftingObject, { kind: "arrow" }> = {
      id: "a1",
      kind: "arrow",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      from: {
        kind: "object",
        objectId: "M1",
        localOffset: { x: 0, y: 0 },
        fallbackPosition: { x: 0, y: 0 },
      },
      to: {
        kind: "route",
        routeId: "r1",
        segmentIndex: 0,
        t: 1,
        normalOffset: 0,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 0, y: 0 },
      },
    };
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    expect(geometry.kind).toBe("arrow");
    if (geometry.kind !== "arrow") return;
    // from = M1 placement, to = route endpoint (port-out at 200,100).
    expect(geometry.from).toEqual({ x: 100, y: 100 });
    expect(geometry.to).toEqual({ x: 200, y: 100 });
    expect(geometry.bounds.width).toBeGreaterThan(0);
  });

  it("resolves a construction line with bounds covering its points and no anchors", () => {
    const object: Extract<DraftingObject, { kind: "construction-line" }> = {
      id: "cl1",
      kind: "construction-line",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 40 },
      ],
      lineStyle: "dashed",
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("construction-line");
    if (geometry.kind !== "construction-line") return;
    expect(geometry.bounds).toMatchObject({
      x: -6,
      y: -6,
      width: 112,
      height: 52,
    });
    expect(geometry.diagnostics).toEqual([]);
  });

  it("reports an unresolved floating symbol and uses anchor fallback bounds", () => {
    const document = documentWithRoute();
    const object: Extract<DraftingObject, { kind: "floating-symbol" }> = {
      id: "fs1",
      kind: "floating-symbol",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 40, y: 40 } },
      symbolId: "does-not-exist",
      transform: { rotation: 0, mirror: "none" },
    };
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    expect(geometry.kind).toBe("floating-symbol");
    if (geometry.kind !== "floating-symbol") return;
    expect(geometry.diagnostics[0]?.code).toBe("DRAFTING_SYMBOL_UNRESOLVED");
    expect(geometry.position).toEqual({ x: 40, y: 40 });
  });

  it("is deterministic: the same input resolves identically", () => {
    const document = documentWithRoute();
    const object = textObject({
      anchor: {
        kind: "object",
        objectId: "M1",
        localOffset: { x: 5, y: -5 },
        fallbackPosition: { x: 0, y: 0 },
      },
    });
    const first = resolveDraftingObjectGeometry(document, resolver, object);
    const second = resolveDraftingObjectGeometry(document, resolver, object);
    expect(second).toEqual(first);
  });
});
