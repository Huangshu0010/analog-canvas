import { describe, expect, it } from "vitest";

import {
  gridAlignmentDiagnostics,
  gridPointsOfEdit,
} from "./transaction-preflight.js";

describe("typed-edit grid preflight", () => {
  it("reports only persisted Route waypoints with their semantic path", () => {
    const edit = {
      kind: "set_route_points" as const,
      routeId: "R1",
      netId: "N1",
      from: { kind: "junction" as const, junctionId: "J1" },
      to: { kind: "junction" as const, junctionId: "J2" },
      waypoints: [{ x: 16, y: 20 }],
      segmentModes: ["manual" as const, "manual" as const],
    };

    expect(gridPointsOfEdit(edit)).toEqual([
      { point: { x: 16, y: 20 }, path: ["waypoints", 0] },
    ]);
    expect(gridAlignmentDiagnostics(edit, 10)).toMatchObject([
      { code: "GRID_ALIGNMENT", path: ["waypoints", 0, "x"] },
    ]);
  });

  it("does not reinterpret non-page scalar geometry as a coordinate", () => {
    expect(
      gridAlignmentDiagnostics(
        {
          kind: "upsert_schematic_annotation",
          annotation: {
            id: "A1",
            kind: "route-marker",
            content: {
              runs: [{ kind: "text", value: "I" }],
            },
            anchor: {
              kind: "route",
              routeId: "R1",
              segmentIndex: 0,
              t: 0.375,
              normalOffset: 3.25,
              direction: "forward",
              orientation: "follow",
              fallbackPosition: { x: 20, y: 30 },
            },
            alignment: "middle",
            rotation: 0,
            locked: false,
            markerKind: "current",
          },
        },
        10,
      ),
    ).toEqual([]);
  });
});
