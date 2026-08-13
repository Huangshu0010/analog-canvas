import { describe, expect, it } from "vitest";

import { migrateV3ToV4 } from "./migration-v3-to-v4.js";

describe("schema 3 to 4 netlist migration", () => {
  it("persists cell interface and unambiguous imported device facts", () => {
    const migrated = migrateV3ToV4({
      schemaVersion: 3,
      documents: [
        {
          id: "doc-ota",
          name: "OTA 5",
          sourceBinding: { cellName: "ota5", sourceRef: {} },
          ports: [{ id: "vinp" }, { id: "vinn" }, { id: "vout" }],
          instances: [
            {
              id: "source-id",
              symbolId: "nmos",
              binding: {
                kind: "opaque",
                name: "nch_mac",
                status: "resolved",
              },
              properties: {
                "spice.name": "M_INP",
                "spice.param.w": "2u",
                "spice.param.l": "60n",
              },
            },
          ],
        },
      ],
    });

    expect(migrated).toMatchObject({
      schemaVersion: 4,
      documents: [
        {
          netlist: { name: "ota5", portOrder: ["vinp", "vinn", "vout"] },
          instances: [
            {
              netlist: {
                reference: "M_INP",
                binding: {
                  kind: "model",
                  deviceClass: "mos",
                  name: "nch_mac",
                },
                parameters: { w: "2u", l: "60n" },
              },
            },
          ],
        },
      ],
    });
  });

  it("assigns references but never invents a manual MOS model", () => {
    const migrated = migrateV3ToV4({
      schemaVersion: 3,
      documents: [
        {
          id: "main",
          name: "Main Circuit",
          ports: [],
          instances: [
            {
              id: "device-a",
              symbolId: "nmos",
              properties: { w: "1u", l: "150n" },
            },
          ],
        },
      ],
    });

    expect(migrated).toMatchObject({
      documents: [
        {
          netlist: { name: "Main_Circuit", portOrder: [] },
          instances: [
            {
              netlist: {
                reference: "M1",
                parameters: { w: "1u", l: "150n" },
              },
            },
          ],
        },
      ],
    });
    const instance = (migrated.documents as any[])[0].instances[0];
    expect(instance.netlist).not.toHaveProperty("binding");
  });

  it("makes duplicate legacy cell and instance names deterministic", () => {
    const migrated = migrateV3ToV4({
      schemaVersion: 3,
      documents: [
        {
          id: "a",
          name: "Gain Stage",
          ports: [],
          instances: [
            { id: "r-a", symbolId: "resistor", properties: {} },
            { id: "r-b", symbolId: "resistor", properties: {} },
          ],
        },
        { id: "b", name: "Gain Stage", ports: [], instances: [] },
      ],
    });
    expect(
      (migrated.documents as any[]).map((item) => item.netlist.name),
    ).toEqual(["Gain_Stage", "Gain_Stage_2"]);
    expect(
      (migrated.documents as any[])[0].instances.map(
        (item: any) => item.netlist.reference,
      ),
    ).toEqual(["R1", "R2"]);
  });
});
