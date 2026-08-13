import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import { migrateV2ToV3 } from "./migration-v2-to-v3.js";
import {
  CircuitProjectSchema,
  CURRENT_PROJECT_SCHEMA_VERSION,
} from "./schema.js";

describe("migrateV2ToV3", () => {
  it("backfills empty noConnects on every document and advances the version", () => {
    const input = {
      schemaVersion: 2,
      documents: [
        { id: "d1", annotations: [], nets: [] },
        { id: "d2", annotations: [], nets: [], noConnects: [] },
      ],
    };
    const migrated = migrateV2ToV3(input);
    expect(migrated.schemaVersion).toBe(3);
    expect(
      (migrated.documents as Array<{ noConnects: unknown[] }>).map(
        (doc) => doc.noConnects,
      ),
    ).toEqual([[], []]);
  });

  it("is idempotent on a record already carrying noConnects", () => {
    const input = {
      schemaVersion: 2,
      documents: [
        {
          id: "d1",
          noConnects: [{ id: "nc1", endpoint: { kind: "port", portId: "p1" } }],
        },
      ],
    };
    const once = migrateV2ToV3(input);
    const twice = migrateV2ToV3(once as Record<string, unknown>);
    expect(twice).toEqual(once);
  });

  it("remains the explicit predecessor of the current schema", () => {
    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(5);
    expect(migrateV2ToV3({ schemaVersion: 2 }).schemaVersion).toBe(3);
  });
});

describe("NoConnect schema invariants", () => {
  function projectWithNoConnect(noConnect: unknown, net?: unknown) {
    const project = createEmptyProject("p", "P");
    const document = project.documents[0]!;
    document.instances = [
      {
        id: "I1",
        symbolId: "dual",
        placement: { position: { x: 0, y: 0 }, rotation: 0, mirror: "none" },
        properties: {},
      },
    ];
    document.ports = [
      {
        id: "port1",
        name: "in",
        direction: "passive",
        position: { x: 0, y: 0 },
      },
    ];
    document.netlist!.portOrder = ["port1"];
    if (net) document.nets = [net as never];
    document.noConnects = [noConnect] as never;
    return CircuitProjectSchema.safeParse(project);
  }

  it("accepts a NoConnect on an unconnected terminal", () => {
    const result = projectWithNoConnect({
      id: "nc1",
      endpoint: { kind: "terminal", instanceId: "I1", pinName: "P" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a NoConnect whose endpoint already belongs to a Net", () => {
    const result = projectWithNoConnect(
      {
        id: "nc1",
        endpoint: { kind: "terminal", instanceId: "I1", pinName: "P" },
      },
      {
        id: "net1",
        name: "n",
        scope: "local",
        terminals: [{ instanceId: "I1", pinName: "P" }],
        ports: [],
      },
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate NoConnects on the same endpoint", () => {
    const project = createEmptyProject("p", "P");
    const document = project.documents[0]!;
    document.ports = [
      {
        id: "port1",
        name: "in",
        direction: "passive",
        position: { x: 0, y: 0 },
      },
    ];
    document.netlist!.portOrder = ["port1"];
    document.noConnects = [
      { id: "nc1", endpoint: { kind: "port", portId: "port1" } },
      { id: "nc2", endpoint: { kind: "port", portId: "port1" } },
    ] as never;
    expect(CircuitProjectSchema.safeParse(project).success).toBe(false);
  });
});
