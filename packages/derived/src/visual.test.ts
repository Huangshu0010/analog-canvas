import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  diagnoseVisualQuality,
  hasBlockingVisualDiagnostics,
  isVisualDiagnosticGateFailure,
} from "./visual.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("visual quality diagnostics", () => {
  it("does not report a legal Route contact through a coincident same-Net terminal", () => {
    const document = createEmptyDocument("doc-contact", "Contact diagnostics");
    document.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: {
        position: { x: 100, y: 120 },
        rotation: 0,
        mirror: "none",
      },
      properties: {},
    });
    document.ports.push(
      {
        id: "left",
        name: "left",
        direction: "passive",
        position: { x: 60, y: 100 },
      },
      {
        id: "right",
        name: "right",
        direction: "passive",
        position: { x: 140, y: 100 },
      },
    );
    document.nets.push({
      id: "net-out",
      scope: "local",
      terminals: [{ instanceId: "R1", pinName: "1" }],
      ports: ["left", "right"],
    });
    document.junctions.push({
      id: "junction-out",
      netId: "net-out",
      position: { x: 100, y: 100 },
      role: "branch",
    });
    document.routes.push(
      {
        id: "route-left",
        netId: "net-out",
        from: { kind: "port", portId: "left" },
        to: { kind: "junction", junctionId: "junction-out" },
        waypoints: [],
        segmentModes: ["manual"],
      },
      {
        id: "route-right",
        netId: "net-out",
        from: { kind: "junction", junctionId: "junction-out" },
        to: { kind: "port", portId: "right" },
        waypoints: [],
        segmentModes: ["manual"],
      },
    );

    expect(
      diagnoseVisualQuality(document, resolver).filter(
        (item) => item.code === "VISUAL_WIRE_THROUGH_SYMBOL",
      ),
    ).toEqual([]);
  });

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
    const diagnostics = diagnoseVisualQuality(document, resolver);
    expect(diagnostics.map((item) => item.code)).toEqual([
      "VISUAL_CONSTRAINT_VIOLATION",
      "VISUAL_SYMBOL_OVERLAP",
      "VISUAL_UNPLACED_INSTANCE",
    ]);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VISUAL_SYMBOL_OVERLAP",
          category: "observation",
          confidence: "low",
          gateEligible: false,
        }),
        expect.objectContaining({
          code: "VISUAL_UNPLACED_INSTANCE",
          category: "structural",
          confidence: "high",
          gateEligible: true,
        }),
      ]),
    );
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
      content: { runs: [{ kind: "line-break" as const }] },
      anchor: { kind: "free" as const, position: { x: 100, y: 100 } },
      alignment: "middle",
      rotation: 0,
      locked: false,
    }));
    expect(diagnoseVisualQuality(document, resolver)).toEqual([]);
  });

  it("uses visible variant geometry instead of a hidden canonical bulk view", () => {
    const document = createEmptyDocument("doc", "Visible MOS bounds");
    document.instances = [0, 40].map((x, index) => ({
      id: `M${index + 1}`,
      symbolId: "nmos",
      symbolVariantId: "textbook-3terminal",
      placement: {
        position: { x, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    }));
    expect(
      diagnoseVisualQuality(document, resolver).filter(
        (item) => item.code === "VISUAL_SYMBOL_OVERLAP",
      ),
    ).toEqual([]);

    document.instances = document.instances.map(
      ({ symbolVariantId: _symbolVariantId, ...instance }) => instance,
    );
    expect(
      diagnoseVisualQuality(document, resolver).filter(
        (item) => item.code === "VISUAL_SYMBOL_OVERLAP",
      ),
    ).toHaveLength(1);
  });

  it("does not report a precise same-Net power-symbol terminal contact as overlap", () => {
    const document = createEmptyDocument("doc", "Power contact");
    document.instances.push(
      {
        id: "M2",
        symbolId: "pmos",
        symbolVariantId: "textbook-3terminal",
        placement: {
          position: { x: 490, y: 290 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
      {
        id: "VDD3",
        symbolId: "vdd",
        placement: {
          position: { x: 500, y: 250 },
          rotation: 0,
          mirror: "none",
        },
        properties: {},
      },
    );
    document.nets.push({
      id: "net-ui-2",
      scope: "local",
      terminals: [
        { instanceId: "M2", pinName: "S" },
        { instanceId: "VDD3", pinName: "P" },
      ],
      ports: [],
    });

    expect(
      diagnoseVisualQuality(document, resolver).filter(
        (item) => item.code === "VISUAL_SYMBOL_OVERLAP",
      ),
    ).toEqual([]);

    document.nets[0]!.terminals = [{ instanceId: "M2", pinName: "S" }];
    expect(
      diagnoseVisualQuality(document, resolver).some(
        (item) => item.code === "VISUAL_SYMBOL_OVERLAP",
      ),
    ).toBe(true);
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
    expect(
      diagnoseVisualQuality(document, resolver).find(
        (item) => item.code === "VISUAL_ROUTE_OVERLAP",
      ),
    ).toMatchObject({
      category: "observation",
      confidence: "medium",
      gateEligible: false,
    });
    const routeOverlap = diagnoseVisualQuality(document, resolver).find(
      (item) => item.code === "VISUAL_ROUTE_OVERLAP",
    )!;
    expect(
      isVisualDiagnosticGateFailure(
        routeOverlap,
        new Set(["VISUAL_ROUTE_OVERLAP"]),
      ),
    ).toBe(false);
    // Metrics never move objects.
    expect(document.routes).toHaveLength(2);
  });
});
