import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  proposeLegacyPowerContactReconciliation,
  proposePlacementContact,
  proposedStandalonePowerConnection,
} from "./placement-connectivity";
import { razaviManualBulkConnectionEdits } from "../../presentation/razavi-presentation";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const context = { symbolResolver: resolver };

function transaction(expectedRevision: number, edits: unknown[]) {
  return {
    transactionId: "placement-contact-test",
    documentId: "main",
    expectedRevision,
    actor: { kind: "human" as const, id: "test" },
    dryRun: false,
    edits,
  };
}

describe("component placement electrical contacts", () => {
  it("creates one global VDD Net when a VDD pin lands exactly on the PMOS source", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push({
      id: "M4",
      symbolId: "pmos",
      symbolVariantId: "textbook-3terminal",
      placement: {
        position: { x: 90, y: 120 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    });
    const vdd = {
      id: "VDD9",
      symbolId: "vdd",
      placement: {
        position: { x: 100, y: 80 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const contact = proposePlacementContact(resolver, vdd, [
      {
        endpoint: { kind: "terminal", instanceId: "M4", pinName: "S" },
        netId: null,
        point: { x: 100, y: 100 },
        preludeEdits: [],
      },
    ]);

    expect(contact).toMatchObject({
      matched: true,
      ambiguous: false,
      edits: [
        {
          kind: "connect_endpoints",
          newNetName: "VDD",
          newNetScope: "global",
          from: { kind: "terminal", instanceId: "VDD9", pinName: "P" },
          to: { kind: "terminal", instanceId: "M4", pinName: "S" },
        },
      ],
    });
    const connected = executeTransaction(
      document,
      transaction(0, [
        { kind: "add_instance", instance: vdd },
        ...contact.edits,
      ]),
      context,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    expect(connected.document.nets).toContainEqual({
      id: "net-contact-vdd9",
      name: "VDD",
      scope: "global",
      terminals: expect.arrayContaining([
        { instanceId: "VDD9", pinName: "P" },
        { instanceId: "M4", pinName: "S" },
      ]),
      ports: [],
    });

    const bulk = razaviManualBulkConnectionEdits(
      connected.document,
      connected.document.instances,
    );
    const bulkConnected = executeTransaction(
      connected.document,
      transaction(connected.document.revision, bulk),
      context,
    );
    expect(bulkConnected.ok).toBe(true);
    if (!bulkConnected.ok) return;
    expect(bulkConnected.document.nets[0]?.terminals).toContainEqual({
      instanceId: "M4",
      pinName: "B",
    });
  });

  it("does not turn an ambiguous visual overlap into an electrical short", () => {
    const document = createEmptyDocument("main", "Main");
    const vdd = {
      id: "VDD1",
      symbolId: "vdd",
      placement: {
        position: { x: 100, y: 80 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const proposal = proposePlacementContact(resolver, vdd, [
      {
        endpoint: { kind: "terminal", instanceId: "M1", pinName: "S" },
        netId: null,
        point: { x: 100, y: 100 },
        preludeEdits: [],
      },
      {
        endpoint: { kind: "terminal", instanceId: "M2", pinName: "S" },
        netId: null,
        point: { x: 100, y: 100 },
        preludeEdits: [],
      },
    ]);

    expect(proposal).toEqual({ edits: [], matched: false, ambiguous: true });
  });

  it("repairs one legacy VDD visual contact but never merges distinct Nets", () => {
    const vdd = {
      id: "VDD1",
      symbolId: "vdd",
      placement: {
        position: { x: 100, y: 80 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const endpoints = [
      {
        endpoint: {
          kind: "terminal" as const,
          instanceId: "VDD1",
          pinName: "P",
        },
        netId: null,
        point: { x: 100, y: 100 },
        preludeEdits: [],
      },
      {
        endpoint: { kind: "terminal" as const, instanceId: "M4", pinName: "S" },
        netId: null,
        point: { x: 100, y: 100 },
        preludeEdits: [],
      },
    ];
    expect(
      proposeLegacyPowerContactReconciliation(resolver, [vdd], endpoints),
    ).toMatchObject([
      {
        kind: "connect_endpoints",
        newNetName: "VDD",
        newNetScope: "global",
      },
    ]);
    expect(
      proposeLegacyPowerContactReconciliation(
        resolver,
        [vdd],
        [
          { ...endpoints[0]!, netId: "net-vdd" },
          { ...endpoints[1]!, netId: "net-body" },
        ],
      ),
    ).toEqual([]);
  });

  it("creates a standalone global ground Net without inventing a wire", () => {
    const ground = {
      id: "GND1",
      symbolId: "ground",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const proposal = proposedStandalonePowerConnection(ground);
    expect(proposal).toMatchObject({
      powerNetId: "net-power-gnd1",
      edits: [
        {
          kind: "connect_endpoints",
          newNetName: "0",
          newNetScope: "global",
          from: { kind: "terminal", instanceId: "GND1", pinName: "0" },
        },
      ],
    });
    const connected = executeTransaction(
      createEmptyDocument("main", "Main"),
      transaction(0, [
        { kind: "add_instance", instance: ground },
        ...proposal.edits,
      ]),
      context,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    expect(connected.document.nets).toContainEqual({
      id: "net-power-gnd1",
      name: "0",
      scope: "global",
      terminals: [{ instanceId: "GND1", pinName: "0" }],
      ports: [],
    });
  });
});
