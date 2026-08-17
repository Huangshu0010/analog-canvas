import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import {
  proposePlacementContact,
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
    expect(proposedStandalonePowerConnection(document, vdd)).toEqual({
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
    const document = createEmptyDocument("main", "Main");
    const proposal = proposedStandalonePowerConnection(document, ground);
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
      document,
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
    });
  });

  it("merges a later Ground component into the canonical bulk supply Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({
      id: "net-global-0",
      name: "0",
      scope: "global",
      powerDomain: "ground",
      terminals: [{ instanceId: "M1", pinName: "B" }],
    });
    document.instances.push({
      id: "M1",
      symbolId: "nmos",
      mosBulkBinding: {
        origin: "supply-default",
        netId: "net-global-0",
      },
      placement: null,
      properties: {},
    });
    const ground = {
      id: "GND2",
      symbolId: "ground",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const proposal = proposedStandalonePowerConnection(document, ground);

    expect(proposal.powerNetId).toBe("net-global-0");
    expect(proposal.edits.at(-1)).toEqual({
      kind: "merge_nets",
      targetNetId: "net-global-0",
      sourceNetId: "net-power-gnd2",
    });
    const connected = executeTransaction(
      document,
      transaction(0, [
        { kind: "add_instance", instance: ground },
        ...proposal.edits,
      ]),
      context,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    expect(connected.document.nets).toHaveLength(1);
    expect(connected.document.nets[0]).toMatchObject({
      id: "net-global-0",
      terminals: expect.arrayContaining([
        { instanceId: "M1", pinName: "B" },
        { instanceId: "GND2", pinName: "0" },
      ]),
    });
  });

  it("creates a standalone global VDD Net from a placed power port", () => {
    const vddPort = {
      id: "VDD1",
      symbolId: "vdd-port",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const document = createEmptyDocument("main", "Main");
    const proposal = proposedStandalonePowerConnection(document, vddPort);
    expect(proposal).toMatchObject({
      powerNetId: "net-power-vdd1",
      powerEndpoint: {
        kind: "terminal",
        instanceId: "VDD1",
        pinName: "P",
      },
      edits: [
        {
          kind: "connect_endpoints",
          newNetName: "VDD",
          newNetScope: "global",
          from: { kind: "terminal", instanceId: "VDD1", pinName: "P" },
        },
        {
          kind: "set_net_power_domain",
          netId: "net-power-vdd1",
          powerDomain: "vdd",
        },
      ],
    });
    const connected = executeTransaction(
      document,
      transaction(0, [
        { kind: "add_instance", instance: vddPort },
        ...proposal.edits,
      ]),
      context,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    expect(connected.document.nets).toContainEqual({
      id: "net-power-vdd1",
      name: "VDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
    });
  });

  it("merges a later VDD power port into the rail's global supply Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({
      id: "net-power-vdd1",
      name: "VDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });
    const vddPort = {
      id: "VDD2",
      symbolId: "vdd-port",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };
    const proposal = proposedStandalonePowerConnection(document, vddPort);

    expect(proposal.powerNetId).toBe("net-power-vdd1");
    expect(proposal.edits.at(-1)).toEqual({
      kind: "merge_nets",
      targetNetId: "net-power-vdd1",
      sourceNetId: "net-power-vdd2",
    });
    const connected = executeTransaction(
      document,
      transaction(0, [
        { kind: "add_instance", instance: vddPort },
        ...proposal.edits,
      ]),
      context,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    expect(connected.document.nets).toHaveLength(1);
    expect(connected.document.nets[0]).toMatchObject({
      id: "net-power-vdd1",
      powerDomain: "vdd",
      terminals: [{ instanceId: "VDD2", pinName: "P" }],
    });
  });

  it("does not merge a VDD marker into a distinct AVDD supply", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({
      id: "net-avdd",
      name: "AVDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });
    const vddPort = {
      id: "VDD2",
      symbolId: "vdd-port",
      placement: {
        position: { x: 100, y: 100 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    };

    const proposal = proposedStandalonePowerConnection(document, vddPort);

    expect(proposal).toMatchObject({
      powerNetId: "net-power-vdd2",
      edits: [
        {
          kind: "connect_endpoints",
          newNetName: "VDD",
          newNetScope: "global",
        },
        {
          kind: "set_net_power_domain",
          netId: "net-power-vdd2",
          powerDomain: "vdd",
        },
      ],
    });
  });
});
