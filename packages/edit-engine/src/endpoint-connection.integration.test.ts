import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import type { SchematicEdit } from "./edit-schema.js";
import { executeTransaction } from "./transaction.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function bulkDocument() {
  const document = createEmptyDocument("bulk-follow", "Bulk follow");
  document.instances.push({
    id: "M1",
    symbolId: "nmos",
    symbolVariantId: "textbook-3terminal",
    placement: {
      position: { x: 100, y: 100 },
      rotation: 0,
      mirror: "none",
    },
  });
  document.nets.push({
    id: "body",
    terminals: [{ instanceId: "M1", pinName: "B" }],
  });
  document.junctions.push({
    id: "J1",
    netId: "body",
    position: { x: 180, y: 100 },
  });
  document.routes.push({
    id: "body-route",
    netId: "body",
    from: { kind: "terminal", instanceId: "M1", pinName: "B" },
    to: { kind: "junction", junctionId: "J1" },
    waypoints: [{ x: 100, y: 100 }],
    segmentModes: ["escape", "manual"],
    presentation: "bulk-dashed",
  });
  return document;
}

function execute(edit: SchematicEdit) {
  const document = bulkDocument();
  return executeTransaction(
    document,
    {
      transactionId: `bulk-${edit.kind}`,
      documentId: document.id,
      expectedRevision: 0,
      actor: { kind: "human", id: "test" },
      edits: [edit],
    },
    { symbolResolver: resolver },
  );
}

describe("EndpointConnection transform lifecycle", () => {
  it("routes the advanced Agent orthogonal edit through the same grid landing", () => {
    const document = bulkDocument();
    document.routes = [];
    const result = executeTransaction(
      document,
      {
        transactionId: "bulk-route-orthogonal",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "agent", id: "test" },
        edits: [
          {
            kind: "route_orthogonal",
            routeId: "body-route-agent",
            netId: "body",
            from: { kind: "terminal", instanceId: "M1", pinName: "B" },
            to: { kind: "junction", junctionId: "J1" },
            presentation: "bulk-dashed",
          },
        ],
      },
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const route = result.document.routes[0]!;
    expect(route.segmentModes[0]).toBe("escape");
    expect(
      route.waypoints.every(
        (point) => point.x % 10 === 0 && point.y % 10 === 0,
      ),
    ).toBe(true);
  });

  it.each([
    [
      "move",
      { kind: "move_instance", instanceId: "M1", position: { x: 120, y: 120 } },
      { x: 120, y: 120 },
    ],
    [
      "rotate",
      { kind: "rotate_instance", instanceId: "M1", rotation: 90 },
      { x: 100, y: 100 },
    ],
    [
      "mirror",
      { kind: "mirror_instance", instanceId: "M1", mirror: "x" },
      { x: 100, y: 100 },
    ],
  ] as const)(
    "keeps the bulk landing on-grid after %s",
    (_name, edit, landing) => {
      const result = execute(edit);
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      const route = result.document.routes.find(
        (candidate) => candidate.id === "body-route",
      )!;
      expect(route.waypoints[0]).toEqual(landing);
      expect(route.segmentModes[0]).toBe("escape");
      expect(
        route.waypoints.every(
          (point) => point.x % 10 === 0 && point.y % 10 === 0,
        ),
      ).toBe(true);
    },
  );
});
