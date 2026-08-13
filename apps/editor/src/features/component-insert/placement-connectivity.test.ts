import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  proposePlacementContact,
  proposePortPlacementContact,
  proposedStandalonePowerConnection,
} from "./placement-connectivity";

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
  it("does not let a legacy VDD marker use generic component placement", () => {
    const document = createEmptyDocument("main", "Main");
    const vdd = {
      id: "VDD2",
      symbolId: "vdd",
      placement: {
        position: { x: 100, y: 80 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const proposal = proposePlacementContact(document, resolver, vdd, []);
    expect(proposal).toEqual({ edits: [], matched: false, ambiguous: false });
    expect(proposedStandalonePowerConnection(vdd)).toEqual({
      edits: [],
      matched: false,
      ambiguous: false,
    });
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
        {
          kind: "set_net_power_domain",
          netId: "net-power-gnd1",
          powerDomain: "ground",
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
      powerDomain: "ground",
      terminals: [{ instanceId: "GND1", pinName: "0" }],
      ports: [],
    });
  });

  it("uses the same exact-contact transaction for a first-class Port", () => {
    const document = createEmptyDocument("main", "Main");
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
    const proposal = proposePortPlacementContact(
      document,
      resolver,
      {
        id: "VIN",
        position: { x: 100, y: 100 },
      },
      [
        {
          endpoint: { kind: "terminal", instanceId: "R1", pinName: "1" },
          netId: null,
          point: { x: 100, y: 100 },
          preludeEdits: [],
        },
      ],
    );
    expect(proposal).toMatchObject({ matched: true, ambiguous: false });
    const result = executeTransaction(
      document,
      transaction(0, [
        {
          kind: "add_port",
          port: {
            id: "VIN",
            name: "Vin",
            direction: "input",
            position: { x: 100, y: 100 },
            presentation: "hollow",
          },
        },
        ...proposal.edits,
      ]),
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.nets).toContainEqual({
      id: "net-contact-vin",
      scope: "local",
      powerDomain: "none",
      terminals: [{ instanceId: "R1", pinName: "1" }],
      ports: ["VIN"],
    });
  });
});
