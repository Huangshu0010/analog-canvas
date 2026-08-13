import { describe, expect, it } from "vitest";

import { migrateV5ToV6 } from "./migration-v5-to-v6.js";

describe("schema 5 to 6 Port migration", () => {
  it("converts legacy Port Symbols while preserving all endpoint references", () => {
    const migrated = migrateV5ToV6({
      schemaVersion: 5,
      documents: [
        {
          id: "main",
          instances: [
            {
              id: "PIN",
              symbolId: "port-filled",
              placement: {
                position: { x: 100, y: 80 },
                rotation: 90,
                mirror: "none",
              },
              properties: { "spice.name": "Vin" },
            },
            { id: "R1", symbolId: "resistor" },
          ],
          ports: [
            {
              id: "OLD",
              name: "Old",
              direction: "passive",
              position: { x: 20, y: 20 },
            },
          ],
          netlist: { portOrder: ["OLD"] },
          nets: [
            {
              id: "net-in",
              scope: "local",
              terminals: [
                { instanceId: "PIN", pinName: "P" },
                { instanceId: "R1", pinName: "1" },
              ],
              ports: [],
            },
          ],
          routes: [
            {
              id: "route-in",
              from: { kind: "terminal", instanceId: "PIN", pinName: "P" },
              to: { kind: "terminal", instanceId: "R1", pinName: "1" },
            },
          ],
          noConnects: [
            {
              id: "nc-pin",
              endpoint: { kind: "terminal", instanceId: "PIN", pinName: "P" },
            },
          ],
        },
      ],
    });

    expect(migrated).toMatchObject({
      schemaVersion: 6,
      documents: [
        {
          instances: [{ id: "R1", symbolId: "resistor" }],
          ports: [
            {
              id: "OLD",
              presentation: "hollow",
            },
            {
              id: "PIN",
              name: "Vin",
              direction: "passive",
              // Rotation of retired terminal local point (10, 0).
              position: { x: 100, y: 90 },
              presentation: "filled",
            },
          ],
          netlist: { portOrder: ["OLD", "PIN"] },
          nets: [
            {
              terminals: [{ instanceId: "R1", pinName: "1" }],
              ports: ["PIN"],
            },
          ],
          routes: [
            {
              from: { kind: "port", portId: "PIN" },
            },
          ],
          noConnects: [
            {
              endpoint: { kind: "port", portId: "PIN" },
            },
          ],
        },
      ],
    });
  });
});
