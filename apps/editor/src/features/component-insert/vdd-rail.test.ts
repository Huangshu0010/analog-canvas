import { describe, expect, it } from "vitest";

import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";

import { constructVddRailEdits } from "./vdd-rail";

const resolver = new InMemorySymbolResolver(builtInSymbols);

describe("drawn VDD rail construction", () => {
  it("uses an unplaced VDD anchor and one horizontal editable power rail", () => {
    const edits = constructVddRailEdits({
      instanceId: "VDD3",
      start: { x: 80, y: 40 },
      end: { x: 260, y: 40 },
    });

    expect(edits).toMatchObject([
      {
        kind: "add_instance",
        instance: { id: "VDD3", symbolId: "vdd", placement: null },
      },
      {
        kind: "connect_endpoints",
        newNetId: "net-power-vdd3",
        newNetName: "VDD",
        newNetScope: "global",
      },
      {
        kind: "add_junction",
        role: "route-anchor",
        position: { x: 80, y: 40 },
      },
      {
        kind: "add_junction",
        role: "route-anchor",
        position: { x: 260, y: 40 },
      },
      {
        kind: "set_route_points",
        routeId: "route-vdd3-rail",
        presentation: "power-rail",
        segmentModes: ["manual"],
      },
      {
        kind: "upsert_annotation",
        annotation: {
          kind: "power-label",
          text: "VDD",
          attachedObjectId: "junction-vdd3-end",
          position: { x: 266, y: 45 },
        },
      },
    ]);
  });

  it("keeps the VDD label at the visual right end for a right-to-left draw", () => {
    const label = constructVddRailEdits({
      instanceId: "VDD4",
      start: { x: 260, y: 40 },
      end: { x: 80, y: 40 },
    }).at(-1);

    expect(label).toMatchObject({
      kind: "upsert_annotation",
      annotation: {
        attachedObjectId: "junction-vdd4-start",
        position: { x: 266, y: 45 },
      },
    });
  });

  it("commits the semantic VDD anchor and visual rail in one transaction", () => {
    const document = createEmptyDocument("main", "Main");
    const result = executeTransaction(
      document,
      {
        transactionId: "draw-vdd-rail",
        documentId: document.id,
        expectedRevision: document.revision,
        actor: { kind: "human", id: "test" },
        edits: constructVddRailEdits({
          instanceId: "VDD1",
          start: { x: 40, y: 20 },
          end: { x: 180, y: 20 },
        }),
      },
      { symbolResolver: resolver },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.instances).toMatchObject([
      { id: "VDD1", placement: null },
    ]);
    expect(result.document.routes).toMatchObject([
      { presentation: "power-rail", netId: "net-power-vdd1" },
    ]);
    expect(result.document.junctions).toHaveLength(2);
  });
});
