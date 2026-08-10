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

describe("resolveDraftingObjectGeometry", () => {
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
    expect(geometry.points).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(geometry.vertices).toEqual(geometry.points);
    expect(geometry.center).toEqual({ x: 150, y: 100 });
    expect(geometry.bounds.width).toBeGreaterThan(0);
  });

  it("keeps free arrow waypoints between independently anchored endpoints", () => {
    const object: Extract<DraftingObject, { kind: "arrow" }> = {
      id: "a-bend",
      kind: "arrow",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      from: { kind: "free", position: { x: 0, y: 0 } },
      waypoints: [{ x: 40, y: 30 }],
      to: { kind: "free", position: { x: 100, y: 30 } },
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("arrow");
    if (geometry.kind !== "arrow") return;
    expect(geometry.points).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 30 },
      { x: 100, y: 30 },
    ]);
    expect(geometry.curveControls).toEqual([null, null]);
    expect(geometry.bounds.height).toBeGreaterThan(30);
  });

  it("preserves a quadratic control for each drafting path segment", () => {
    const object: Extract<DraftingObject, { kind: "arrow" }> = {
      id: "a-curve",
      kind: "arrow",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      from: { kind: "free", position: { x: 0, y: 0 } },
      to: { kind: "free", position: { x: 100, y: 0 } },
      curveControls: [{ x: 50, y: 40 }],
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("arrow");
    if (geometry.kind !== "arrow") return;
    expect(geometry.curveControls).toEqual([{ x: 50, y: 40 }]);
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
      curveControls: [{ x: 35, y: 80 }],
      lineStyle: "dashed",
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("construction-line");
    if (geometry.kind !== "construction-line") return;
    expect(geometry.curveControls).toEqual([{ x: 35, y: 80 }]);
    expect(geometry.bounds).toMatchObject({
      x: -6,
      y: -6,
      width: 112,
      height: 52,
    });
    expect(geometry.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 40 },
    ]);
    expect(geometry.diagnostics).toEqual([]);
  });

  it("resolves a rotated rectangle into four shared render corners", () => {
    const object: Extract<DraftingObject, { kind: "rectangle" }> = {
      id: "rect1",
      kind: "rectangle",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 100, y: 80 } },
      center: { x: 100, y: 80 },
      width: 80,
      height: 40,
      rotation: 90,
      lineStyle: "solid",
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("rectangle");
    if (geometry.kind !== "rectangle") return;
    expect(geometry.corners[0]).toMatchObject({ x: 120, y: 40 });
    expect(geometry.corners[2]).toMatchObject({ x: 80, y: 120 });
    expect(geometry.bounds).toMatchObject({
      x: 74,
      y: 34,
      width: 52,
      height: 92,
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

  it("composes route-anchor and object rotation", () => {
    const document = documentWithRoute();
    // A follow-anchored text with object rotation 90 reports 90 (route is
    // horizontal at 0), the single truth the renderer must use.
    const object = textObject({
      rotation: 90,
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
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    expect(geometry.kind).toBe("text");
    if (geometry.kind !== "text") return;
    expect(geometry.rotation).toBe(90);

    // A non-follow route anchor keeps the object rotation unchanged.
    const horizontal = textObject({
      rotation: 90,
      anchor: {
        kind: "route",
        routeId: "r1",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: 0,
        direction: "forward",
        orientation: "horizontal",
        fallbackPosition: { x: 0, y: 0 },
      },
    });
    const hg = resolveDraftingObjectGeometry(document, resolver, horizontal);
    if (hg.kind !== "text") return;
    expect(hg.rotation).toBe(90);

    // A free anchor reports exactly the object rotation.
    const free = textObject({ rotation: 90 });
    const fg = resolveDraftingObjectGeometry(document, resolver, free);
    if (fg.kind !== "text") return;
    expect(fg.rotation).toBe(90);
  });

  it("transforms floating-symbol viewBox corners for rotation and mirror", () => {
    const document = documentWithRoute();
    const base: Extract<DraftingObject, { kind: "floating-symbol" }> = {
      id: "fs1",
      kind: "floating-symbol",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      symbolId: "decorative-note-box",
      transform: { rotation: 0, mirror: "none" },
    };
    const unrotated = resolveDraftingObjectGeometry(document, resolver, base);
    if (unrotated.kind !== "floating-symbol") return;
    // decorative-note-box viewBox is {x:-30,y:-14,width:60,height:28}.
    expect(unrotated.bounds).toMatchObject({
      x: -30,
      y: -14,
      width: 60,
      height: 28,
    });

    // Rotated 90 swaps width/height around the anchor.
    const rotated = resolveDraftingObjectGeometry(document, resolver, {
      ...base,
      transform: { rotation: 90, mirror: "none" },
    });
    if (rotated.kind !== "floating-symbol") return;
    expect(rotated.bounds.width).toBeCloseTo(28, 0);
    expect(rotated.bounds.height).toBeCloseTo(60, 0);

    // Mirror-x keeps the bounds centered on the anchor (AABB symmetric).
    const mirrored = resolveDraftingObjectGeometry(document, resolver, {
      ...base,
      transform: { rotation: 0, mirror: "x" },
    });
    if (mirrored.kind !== "floating-symbol") return;
    expect(mirrored.bounds).toMatchObject({
      x: -30,
      y: -14,
      width: 60,
      height: 28,
    });
  });

  it("measures multi-line text bounds with per-line height", () => {
    const document = documentWithRoute();
    const object: Extract<DraftingObject, { kind: "text" }> = {
      id: "t-multi",
      kind: "text",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 100, y: 100 } },
      content: {
        runs: [
          { kind: "text", value: "line one" },
          { kind: "line-break" },
          { kind: "text", value: "line two" },
        ],
      },
      alignment: "start",
      rotation: 0,
    };
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    expect(geometry.kind).toBe("text");
    if (geometry.kind !== "text") return;
    // Two lines => height roughly 2 * 16 * 1.35 + padding; width covers the
    // longer line ("line two" = 8 chars).
    expect(geometry.bounds.height).toBeGreaterThan(40);
    expect(geometry.bounds.width).toBeGreaterThan(8 * 16 * 0.6);
  });

  it("uses the selected profile and style size for bounds", () => {
    const razavi = documentWithRoute();
    const textbook = documentWithRoute();
    textbook.presentation.styleProfileId = "textbook-monochrome-v1";
    const object = textObject({
      typographyToken: "caption",
      styleOverride: { sizeScale: 2 },
    });
    const large = resolveDraftingObjectGeometry(razavi, resolver, object);
    const small = resolveDraftingObjectGeometry(textbook, resolver, {
      ...object,
      styleOverride: undefined,
    });
    expect(large.bounds.width).toBeGreaterThan(small.bounds.width * 1.5);
  });

  it("reports a callout text hit box separately from its leader", () => {
    const object: Extract<DraftingObject, { kind: "callout" }> = {
      id: "callout-1",
      kind: "callout",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 50, y: 50 } },
      target: { kind: "free", position: { x: 200, y: 100 } },
      content: { runs: [{ kind: "text", value: "Inspect this node" }] },
      alignment: "start",
      rotation: 0,
    };
    const geometry = resolveDraftingObjectGeometry(
      documentWithRoute(),
      resolver,
      object,
    );
    expect(geometry.kind).toBe("callout");
    if (geometry.kind !== "callout") return;
    expect(geometry.textBounds.width).toBeGreaterThan(100);
    expect(geometry.bounds.width).toBeGreaterThanOrEqual(
      geometry.textBounds.width,
    );
  });
});

it("distinguishes an invalid route segment from a missing target (P2)", () => {
  const document = documentWithRoute();
  const object = textObject({
    anchor: {
      kind: "route",
      routeId: "r1",
      segmentIndex: 99,
      t: 0.5,
      normalOffset: 0,
      direction: "forward",
      orientation: "follow",
      fallbackPosition: { x: 0, y: 0 },
    },
  });
  const geometry = resolveDraftingObjectGeometry(document, resolver, object);
  expect(geometry.kind).toBe("text");
  if (geometry.kind !== "text") return;
  expect(geometry.diagnostics[0]?.code).toBe("DRAFTING_ROUTE_SEGMENT_INVALID");

  // A missing route is a different, actionable failure.
  const missing = textObject({
    anchor: {
      kind: "route",
      routeId: "gone",
      segmentIndex: 0,
      t: 0.5,
      normalOffset: 0,
      direction: "forward",
      orientation: "follow",
      fallbackPosition: { x: 1, y: 1 },
    },
  });
  const mg = resolveDraftingObjectGeometry(document, resolver, missing);
  if (mg.kind !== "text") return;
  expect(mg.diagnostics[0]?.code).toBe("DRAFTING_ANCHOR_TARGET_MISSING");
});
