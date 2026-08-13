import { describe, expect, it } from "vitest";

import { migrateV4ToV5 } from "./migration-v4-to-v5.js";

describe("schema 4 to 5 power-domain migration", () => {
  it("persists legacy VDD/ground evidence exactly once on each Net", () => {
    const migrated = migrateV4ToV5({
      schemaVersion: 4,
      documents: [
        {
          id: "main",
          instances: [
            { id: "VDD1", symbolId: "vdd" },
            { id: "GND1", symbolId: "ground" },
          ],
          nets: [
            {
              id: "supply",
              scope: "local",
              terminals: [{ instanceId: "VDD1", pinName: "P" }],
              ports: [],
            },
            {
              id: "return",
              scope: "local",
              terminals: [{ instanceId: "GND1", pinName: "0" }],
              ports: [],
            },
            {
              id: "short",
              scope: "local",
              terminals: [
                { instanceId: "VDD1", pinName: "P" },
                { instanceId: "GND1", pinName: "0" },
              ],
              ports: [],
            },
            { id: "signal", scope: "local", terminals: [], ports: [] },
          ],
        },
      ],
    });

    expect(migrated).toMatchObject({
      schemaVersion: 5,
      documents: [
        {
          nets: [
            { id: "supply", powerDomain: "vdd" },
            { id: "return", powerDomain: "ground" },
            { id: "short", powerDomain: "conflict" },
            { id: "signal", powerDomain: "none" },
          ],
        },
      ],
    });
  });

  it("preserves an explicit value without re-inferring it", () => {
    const migrated = migrateV4ToV5({
      schemaVersion: 4,
      documents: [
        {
          id: "main",
          instances: [{ id: "VDD1", symbolId: "vdd" }],
          nets: [
            {
              id: "reviewed",
              scope: "local",
              powerDomain: "none",
              terminals: [{ instanceId: "VDD1", pinName: "P" }],
              ports: [],
            },
          ],
        },
      ],
    });
    expect((migrated.documents as any[])[0].nets[0].powerDomain).toBe("none");
  });
});
