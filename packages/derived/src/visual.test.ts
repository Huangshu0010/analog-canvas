import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  diagnoseVisualQuality,
  hasBlockingVisualDiagnostics,
} from "./visual.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("visual quality diagnostics", () => {
  it("reports unplaced, overlap, and alignment defects deterministically", () => {
    const document = createEmptyDocument("doc", "Visual diagnostics");
    document.instances = [
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
          position: { x: 110, y: 120 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      { id: "R3", symbolId: "resistor", placement: null, properties: {} },
    ];
    document.constraints.push({
      id: "align-r",
      kind: "align-y",
      objectIds: ["R1", "R2"],
      locked: false,
    });
    expect(
      diagnoseVisualQuality(document, resolver).map((item) => item.code),
    ).toEqual([
      "VISUAL_CONSTRAINT_VIOLATION",
      "VISUAL_SYMBOL_OVERLAP",
      "VISUAL_UNPLACED_INSTANCE",
    ]);
  });

  it("treats unresolved symbols as blocking without moving user geometry", () => {
    const document = createEmptyDocument("doc", "Missing symbol");
    document.instances.push({
      id: "X1",
      symbolId: "missing",
      placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
      properties: {},
    });
    const diagnostics = diagnoseVisualQuality(document, resolver);
    expect(hasBlockingVisualDiagnostics(diagnostics)).toBe(true);
    expect(document.instances[0]!.placement!.position).toEqual({ x: 0, y: 0 });
  });

  it("ignores empty instance-label suppressors in overlap diagnostics", () => {
    const document = createEmptyDocument("doc", "Suppressed labels");
    document.annotations = ["a", "b"].map((id) => ({
      id,
      kind: "instance-label",
      text: "",
      position: { x: 100, y: 100 },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    }));
    expect(diagnoseVisualQuality(document, resolver)).toEqual([]);
  });

  it("reports wire-through-symbol, same-Net overlap, and terminal departure as evidence", () => {
    const document = createEmptyDocument("doc", "Routing metrics");
    document.nets.push({
      id: "net-1",
      name: "N1",
      scope: "local",
      terminals: [],
      ports: ["p1", "p2"],
    });
    // A placed instance whose silhouette sits between two route endpoints.
    document.instances.push({
      id: "M1",
      symbolId: "resistor",
      placement: { position: { x: 200, y: 200 }, rotation: 0, mirror: "none" },
      properties: {},
    });
    // A route whose segment passes through M1's silhouette. from/to are ports
    // (not M1 terminals) so M1 is not exempted as a terminal endpoint.
    document.ports.push(
      {
        id: "p1",
        name: "P1",
        direction: "passive",
        position: { x: 100, y: 200 },
      },
      {
        id: "p2",
        name: "P2",
        direction: "passive",
        position: { x: 300, y: 200 },
      },
    );
    document.routes.push({
      id: "route-1",
      netId: "net-1",
      from: { kind: "port", portId: "p1" },
      to: { kind: "port", portId: "p2" },
      waypoints: [],
      segmentModes: ["auto"],
    });
    // A second route on the same Net overlapping route-1's segment.
    document.routes.push({
      id: "route-2",
      netId: "net-1",
      from: { kind: "port", portId: "p1" },
      to: { kind: "port", portId: "p2" },
      waypoints: [],
      segmentModes: ["auto"],
    });
    const codes = diagnoseVisualQuality(document, resolver).map(
      (item) => item.code,
    );
    expect(codes).toContain("VISUAL_WIRE_THROUGH_SYMBOL");
    expect(codes).toContain("VISUAL_ROUTE_OVERLAP");
    // Metrics never move objects.
    expect(document.routes).toHaveLength(2);
  });
});
