import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);

function transaction(edits: unknown[], expectedRevision = 0) {
  return {
    transactionId: `phase-8-${expectedRevision}`,
    documentId: "document-main",
    expectedRevision,
    actor: { kind: "human" as const, id: "human-test" },
    edits,
  };
}

function addInstance(id: string, symbolId: string, x: number) {
  return {
    kind: "add_instance" as const,
    instance: {
      id,
      symbolId,
      placement: {
        position: { x, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    },
  };
}

describe("Phase 8 semantic authoring", () => {
  it("adds devices and connects two previously unconnected pins atomically", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(
      document,
      transaction([
        addInstance("R1", "resistor", 100),
        addInstance("R2", "resistor", 220),
        {
          kind: "connect_endpoints",
          from: { kind: "terminal", instanceId: "R1", pinName: "2" },
          to: { kind: "terminal", instanceId: "R2", pinName: "1" },
          newNetId: "net-ui-1",
        },
        {
          kind: "set_route_points",
          routeId: "route-ui-1",
          netId: "net-ui-1",
          from: { kind: "terminal", instanceId: "R1", pinName: "2" },
          to: { kind: "terminal", instanceId: "R2", pinName: "1" },
          waypoints: [],
          segmentModes: ["manual"],
        },
      ]),
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({
      ok: true,
      revision: 1,
      document: {
        sourceStatus: "connectivity-modified",
        instances: [{ id: "R1" }, { id: "R2" }],
        nets: [{ id: "net-ui-1", terminals: [{}, {}] }],
        routes: [{ id: "route-ui-1", netId: "net-ui-1" }],
      },
    });
    expect(document.instances).toHaveLength(0);
  });

  it("merges complete route and junction ownership into one target Net", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(
      addInstance("R1", "resistor", 100).instance,
      addInstance("R2", "resistor", 220).instance,
    );
    document.nets.push(
      {
        id: "net-a",
        scope: "local",
        terminals: [{ instanceId: "R1", pinName: "2" }],
        ports: [],
      },
      {
        id: "net-b",
        scope: "local",
        terminals: [{ instanceId: "R2", pinName: "1" }],
        ports: [],
      },
    );
    document.junctions.push({
      id: "junction-b",
      netId: "net-b",
      position: { x: 180, y: 100 },
    });
    document.routes.push({
      id: "route-b",
      netId: "net-b",
      from: { kind: "terminal", instanceId: "R2", pinName: "1" },
      to: { kind: "junction", junctionId: "junction-b" },
      waypoints: [],
      segmentModes: ["manual"],
    });

    const result = executeTransaction(
      document,
      transaction([
        { kind: "merge_nets", targetNetId: "net-a", sourceNetId: "net-b" },
      ]),
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({
      ok: true,
      document: {
        sourceStatus: "connectivity-modified",
        nets: [{ id: "net-a", terminals: [{}, {}] }],
        routes: [{ id: "route-b", netId: "net-a" }],
        junctions: [{ id: "junction-b", netId: "net-a" }],
      },
    });
  });

  it("rejects a connected instance removal without partial mutation", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(addInstance("R1", "resistor", 100).instance);
    document.nets.push({
      id: "net-a",
      scope: "local",
      terminals: [{ instanceId: "R1", pinName: "1" }],
      ports: [],
    });
    const before = structuredClone(document);

    const result = executeTransaction(
      document,
      transaction([{ kind: "remove_instance", instanceId: "R1" }]),
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({ ok: false, applied: false });
    expect(result.document).toBe(document);
    expect(document).toEqual(before);
  });

  it("rejects an atomic group move when one member is layout-locked", () => {
    const document = createEmptyDocument("document-main", "Main");
    document.instances.push(
      addInstance("R1", "resistor", 100).instance,
      addInstance("R2", "resistor", 220).instance,
    );
    document.layoutGroups.push({
      id: "locked-pair",
      kind: "matched-pair",
      objectIds: ["R2"],
      locked: true,
    });

    const result = executeTransaction(
      document,
      transaction([
        {
          kind: "move_instance",
          instanceId: "R1",
          position: { x: 120, y: 100 },
        },
        {
          kind: "move_instance",
          instanceId: "R2",
          position: { x: 240, y: 100 },
        },
      ]),
      { symbolResolver: resolver },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("locked-pair") },
    });
    expect(
      document.instances.map((instance) => instance.placement?.position.x),
    ).toEqual([100, 220]);
  });
});
