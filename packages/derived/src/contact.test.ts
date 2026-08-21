import { createEmptyDocument } from "@icm/model";
import type { SchematicDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  contactRequiresJunctionDot,
  deriveDocumentContactEvidence,
} from "./contact.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

interface RouteSpec {
  id: string;
  from: { x: number; y: number } | { instanceId: string; pinName: string };
  to: { x: number; y: number } | { instanceId: string; pinName: string };
}

/** One-net document: loose anchors for point ends, terminals for pin ends. */
function documentWith(
  routes: RouteSpec[],
  instances: Array<{
    id: string;
    symbolId: string;
    position: { x: number; y: number };
    rotation?: 0 | 90 | 180 | 270;
    pins: string[];
  }> = [],
): SchematicDocument {
  const document = createEmptyDocument("contact", "Contact");
  const net = {
    id: "net-1",
    scope: "local" as const,
    terminals: [] as Array<{ instanceId: string; pinName: string }>,
  };
  document.nets.push(net);
  for (const instance of instances) {
    document.instances.push({
      id: instance.id,
      symbolId: instance.symbolId,
      symbolVariantId:
        instance.symbolId === "pmos" || instance.symbolId === "nmos"
          ? "textbook-3terminal"
          : undefined,
      placement: {
        position: instance.position,
        rotation: instance.rotation ?? 0,
        mirror: "none",
      },
    });
    for (const pinName of instance.pins) {
      net.terminals.push({ instanceId: instance.id, pinName });
    }
  }
  let anchorSuffix = 0;
  const endpointFor = (
    end: RouteSpec["from"],
  ): SchematicDocument["routes"][number]["from"] => {
    if ("instanceId" in end) {
      return {
        kind: "terminal",
        instanceId: end.instanceId,
        pinName: end.pinName,
      };
    }
    anchorSuffix += 1;
    const id = `anchor-${anchorSuffix}`;
    document.junctions.push({
      id,
      netId: net.id,
      position: { x: end.x, y: end.y },
      role: "route-anchor",
    });
    return { kind: "junction", junctionId: id };
  };
  for (const route of routes) {
    document.routes.push({
      id: route.id,
      netId: net.id,
      from: endpointFor(route.from),
      to: endpointFor(route.to),
      waypoints: [],
      segmentModes: ["manual"],
    });
  }
  return document;
}

function dotAt(
  document: SchematicDocument,
  point: { x: number; y: number },
): boolean {
  const evidence = deriveDocumentContactEvidence(document, resolver);
  const contact = evidence.contacts.find(
    (candidate) =>
      candidate.point.x === point.x && candidate.point.y === point.y,
  );
  if (!contact) throw new Error(`no contact at ${point.x},${point.y}`);
  return contactRequiresJunctionDot(contact);
}

describe("contactRequiresJunctionDot", () => {
  it("keeps a straight two-arm join dotless", () => {
    const document = documentWith([
      { id: "left", from: { x: -60, y: 0 }, to: { x: 0, y: 0 } },
      { id: "right", from: { x: 0, y: 0 }, to: { x: 60, y: 0 } },
    ]);
    expect(dotAt(document, { x: 0, y: 0 })).toBe(false);
  });

  it("dots a three-way route branch", () => {
    const document = documentWith([
      { id: "left", from: { x: -60, y: 0 }, to: { x: 0, y: 0 } },
      { id: "right", from: { x: 0, y: 0 }, to: { x: 60, y: 0 } },
      { id: "down", from: { x: 0, y: 0 }, to: { x: 0, y: 60 } },
    ]);
    expect(dotAt(document, { x: 0, y: 0 })).toBe(true);
  });

  it("dots a pin tapped by a straight-through conductor", () => {
    // Resistor pin 1 sits at (0,0): body at (0,20), pin 1 local (0,-20).
    const document = documentWith(
      [
        {
          id: "left",
          from: { x: -60, y: 0 },
          to: { instanceId: "R1", pinName: "1" },
        },
        {
          id: "right",
          from: { instanceId: "R1", pinName: "1" },
          to: { x: 60, y: 0 },
        },
      ],
      [
        {
          id: "R1",
          symbolId: "resistor",
          position: { x: 0, y: 20 },
          pins: ["1"],
        },
      ],
    );
    expect(dotAt(document, { x: 0, y: 0 })).toBe(true);
  });

  it("never dots collinear overlapping arms ending on one pin", () => {
    // The reported PMOS-gate regression: two same-net routes arrive at the
    // gate from the SAME direction (their drawn segments lie on top of each
    // other), plus the pin. Visually this is one wire meeting one pin.
    const document = documentWith(
      [
        {
          id: "near",
          from: { x: -20, y: 70 },
          to: { instanceId: "M1", pinName: "G" },
        },
        {
          id: "far",
          from: { x: -20, y: 80 },
          to: { instanceId: "M1", pinName: "G" },
        },
      ],
      [{ id: "M1", symbolId: "pmos", position: { x: 0, y: 0 }, pins: ["G"] }],
    );
    // PMOS gate pin resolves at (-20, 0).
    expect(dotAt(document, { x: -20, y: 0 })).toBe(false);
  });

  it("still dots coincident pins joined by one arm", () => {
    // Two resistor pins meet at (0,0) (bodies above and below), plus a wire:
    // per-terminal counting is preserved even though the arms overlap none.
    const document = documentWith(
      [
        {
          id: "tap",
          from: { x: -60, y: 0 },
          to: { instanceId: "R1", pinName: "1" },
        },
      ],
      [
        {
          id: "R1",
          symbolId: "resistor",
          position: { x: 0, y: 20 },
          pins: ["1"],
        },
        {
          id: "R2",
          symbolId: "resistor",
          position: { x: 0, y: -20 },
          rotation: 180,
          pins: ["1"],
        },
      ],
    );
    expect(dotAt(document, { x: 0, y: 0 })).toBe(true);
  });

  it("keeps a corner-into-pin tap dotted", () => {
    const document = documentWith(
      [
        {
          id: "vertical",
          from: { x: -20, y: 70 },
          to: { instanceId: "M1", pinName: "G" },
        },
        {
          id: "horizontal",
          from: { x: -80, y: 0 },
          to: { instanceId: "M1", pinName: "G" },
        },
      ],
      [{ id: "M1", symbolId: "pmos", position: { x: 0, y: 0 }, pins: ["G"] }],
    );
    expect(dotAt(document, { x: -20, y: 0 })).toBe(true);
  });
});
