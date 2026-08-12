import { describe, expect, it } from "vitest";

import {
  logicalToleranceForScale,
  resolvePointSnap,
  resolveTranslationSnap,
  SNAP_PROFILES,
} from "./engine";

describe("unified Snap Engine", () => {
  it("converts a fixed screen tolerance across zoom levels", () => {
    expect(logicalToleranceForScale(8, 2)).toBe(4);
    expect(logicalToleranceForScale(8, 0.5)).toBe(16);
  });
  it("resolves independent x/y extension-line matches before the grid", () => {
    const result = resolveTranslationSnap({
      rawDelta: { x: 18, y: 27 },
      movingAnchors: [
        { id: "moving-center", point: { x: 0, y: 0 }, kind: "instance-center" },
      ],
      targetAnchors: [
        {
          id: "vertical-center",
          point: { x: 20, y: 100 },
          kind: "instance-center",
          axes: ["x"],
        },
        {
          id: "horizontal-guide",
          point: { x: 100, y: 30 },
          kind: "guide",
          axes: ["y"],
        },
      ],
      primaryAnchorId: "moving-center",
      grid: 10,
      tolerance: 4,
      profile: SNAP_PROFILES.instanceMove,
    });

    expect(result.delta).toEqual({ x: 20, y: 30 });
    expect(result.xMatch?.targetAnchorId).toBe("vertical-center");
    expect(result.yMatch?.targetAnchorId).toBe("horizontal-guide");
    expect(result.guides).toHaveLength(2);
  });

  it("keeps a captured axis until the larger release tolerance is exceeded", () => {
    const request = {
      rawDelta: { x: 9, y: 0 },
      movingAnchors: [
        {
          id: "moving",
          point: { x: 0, y: 0 },
          kind: "instance-center" as const,
        },
      ],
      targetAnchors: [
        {
          id: "target",
          point: { x: 10, y: 20 },
          kind: "instance-center" as const,
          axes: ["x" as const],
        },
      ],
      primaryAnchorId: "moving",
      grid: 10,
      tolerance: 2,
      profile: SNAP_PROFILES.instanceMove,
    };
    const first = resolveTranslationSnap(request);
    const retained = resolveTranslationSnap(
      { ...request, rawDelta: { x: 12.5, y: 0 } },
      first,
    );

    expect(first.delta.x).toBe(10);
    expect(retained.delta.x).toBe(10);
  });

  it("returns the same resolved delta when pointer-up reuses the preview result", () => {
    const request = {
      rawDelta: { x: 18, y: 19 },
      movingAnchors: [
        {
          id: "moving",
          point: { x: 0, y: 0 },
          kind: "instance-center" as const,
        },
      ],
      targetAnchors: [
        {
          id: "target",
          point: { x: 20, y: 20 },
          kind: "instance-center" as const,
        },
      ],
      primaryAnchorId: "moving",
      grid: 10,
      tolerance: 4,
      profile: SNAP_PROFILES.instanceMove,
    };
    const preview = resolveTranslationSnap(request);
    const commit = resolveTranslationSnap(request, preview);

    expect(commit.delta).toEqual(preview.delta);
    expect(commit.guides).toEqual(preview.guides);
  });

  it("uses the declared primary anchor for group grid snapping", () => {
    const result = resolveTranslationSnap({
      rawDelta: { x: 4, y: 4 },
      movingAnchors: [
        { id: "other", point: { x: 3, y: 3 }, kind: "instance-center" },
        { id: "primary", point: { x: 10, y: 10 }, kind: "instance-center" },
      ],
      targetAnchors: [],
      primaryAnchorId: "primary",
      grid: 10,
      tolerance: 2,
      profile: SNAP_PROFILES.instanceMove,
    });

    expect(result.delta).toEqual({ x: 0, y: 0 });
  });

  it("does not align an instance center to an unrelated pin axis", () => {
    const result = resolveTranslationSnap({
      rawDelta: { x: 18, y: 0 },
      movingAnchors: [
        { id: "center", point: { x: 0, y: 0 }, kind: "instance-center" },
      ],
      targetAnchors: [
        {
          id: "pin",
          point: { x: 20, y: 0 },
          kind: "pin",
          electrical: {
            endpoint: { kind: "terminal", instanceId: "R1", pinName: "1" },
            netId: null,
          },
        },
      ],
      primaryAnchorId: "center",
      grid: 10,
      tolerance: 4,
      profile: SNAP_PROFILES.instanceMove,
    });

    expect(result.xMatch?.targetKind).toBe("grid");
  });

  it("rejects a boundary match that would move an instance off grid", () => {
    const result = resolveTranslationSnap({
      rawDelta: { x: 21, y: 0 },
      movingAnchors: [
        { id: "origin", point: { x: 0, y: 0 }, kind: "instance-center" },
        {
          id: "right-edge",
          point: { x: 5, y: 0 },
          kind: "instance-edge",
          axes: ["x"],
        },
      ],
      targetAnchors: [
        {
          id: "peer-edge",
          point: { x: 28, y: 0 },
          kind: "instance-edge",
          axes: ["x"],
        },
      ],
      primaryAnchorId: "origin",
      grid: 10,
      tolerance: 4,
      profile: SNAP_PROFILES.instanceMove,
    });

    expect(result.delta.x).toBe(20);
    expect(result.xMatch?.targetKind).toBe("grid");
  });

  it("returns an exact compatible electrical match for connection semantics", () => {
    const movingEndpoint = {
      kind: "terminal" as const,
      instanceId: "M1",
      pinName: "D",
    };
    const targetEndpoint = { kind: "junction" as const, junctionId: "j1" };
    const result = resolveTranslationSnap({
      rawDelta: { x: 9, y: 11 },
      movingAnchors: [
        {
          id: "moving-pin",
          point: { x: 0, y: 0 },
          kind: "pin",
          electrical: { endpoint: movingEndpoint, netId: null },
        },
      ],
      targetAnchors: [
        {
          id: "target-junction",
          point: { x: 10, y: 10 },
          kind: "junction",
          electrical: { endpoint: targetEndpoint, netId: "n1" },
        },
      ],
      primaryAnchorId: "moving-pin",
      grid: 10,
      tolerance: 3,
      profile: SNAP_PROFILES.instanceMove,
    });

    expect(result.delta).toEqual({ x: 10, y: 10 });
    expect(result.electricalMatch?.moving.electrical?.endpoint).toEqual(
      movingEndpoint,
    );
    expect(result.electricalMatch?.target.electrical?.endpoint).toEqual(
      targetEndpoint,
    );
  });

  it("does not turn drafting point snap into an electrical match", () => {
    const result = resolvePointSnap(
      { x: 12, y: 12 },
      [
        {
          id: "pin",
          point: { x: 10, y: 10 },
          kind: "pin",
          electrical: {
            endpoint: { kind: "terminal", instanceId: "M1", pinName: "G" },
            netId: null,
          },
        },
      ],
      { grid: 10, tolerance: 4, profile: SNAP_PROFILES.draftingHandle },
    );

    expect(result.delta).toEqual({ x: -2, y: -2 });
    expect(result.electricalMatch).toBeUndefined();
    expect(result.pointMatch?.id).toBe("pin");
  });

  it("excludes the active Wire source and reports equal coincident targets", () => {
    const result = resolvePointSnap(
      { x: 10, y: 10 },
      [
        { id: "source", point: { x: 10, y: 10 }, kind: "pin" },
        { id: "target-a", point: { x: 10, y: 10 }, kind: "pin" },
        { id: "target-b", point: { x: 10, y: 10 }, kind: "pin" },
      ],
      {
        grid: 10,
        tolerance: 4,
        profile: SNAP_PROFILES.wire,
        excludedTargetIds: new Set(["source"]),
      },
    );

    expect(result.pointMatch?.id).toBe("target-a");
    expect(result.pointMatches?.map((target) => target.id)).toEqual([
      "target-a",
      "target-b",
    ]);
  });
});
