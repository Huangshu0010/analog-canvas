import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import { migrateV7ToV8 } from "./migration-v7-to-v8.js";
import { parseProject, serializeProject } from "./persistence.js";
import { CircuitProjectSchema } from "./schema.js";

describe("migrateV7ToV8", () => {
  it("moves SPICE source facts into typed netlist data and immutable provenance", () => {
    const project = createEmptyProject("p", "Project");
    const raw = {
      ...project,
      schemaVersion: 7,
      documents: [
        {
          ...project.documents[0]!,
          instances: [
            {
              id: "X1",
              symbolId: "nmos",
              placement: null,
              properties: {
                "spice.name": "XM1",
                "spice.target": "model:sky130_nfet",
                "spice.param.w": "1u",
                "spice.param.l": "150n",
                "spice.pin.P1": "D",
                "spice.pin.P2": "G",
                "spice.pin.P3": "S",
                "spice.pin.P4": "B",
                "spice.childDocumentId": "child",
                "symbol.mapping.registry": "sky130",
              },
              binding: {
                kind: "model",
                name: "sky130_nfet",
                status: "resolved",
                modelType: "nmos",
              },
              netlist: {
                reference: "XM1",
                parameters: { w: "1u", l: "150n" },
                binding: {
                  kind: "external-subcircuit",
                  name: "child",
                },
              },
            },
          ],
        },
      ],
    };
    const migrated = migrateV7ToV8(raw);
    const instance = (migrated.documents as Array<Record<string, unknown>>)[0]!
      .instances as Array<Record<string, unknown>>;
    expect(instance[0]).toMatchObject({
      properties: { "symbol.mapping.registry": "sky130" },
      importProvenance: {
        kind: "model",
        name: "sky130_nfet",
        sourceTarget: "model:sky130_nfet",
        status: "resolved",
        modelType: "nmos",
      },
      netlist: {
        reference: "XM1",
        parameters: { w: "1u", l: "150n" },
        terminals: [
          { sourcePosition: 0, pinName: "D" },
          { sourcePosition: 1, pinName: "G" },
          { sourcePosition: 2, pinName: "S" },
          { sourcePosition: 3, pinName: "B" },
        ],
      },
    });
    expect(instance[0]).not.toHaveProperty("binding");
    expect(JSON.stringify(instance[0])).not.toContain("spice.");
  });

  it("links only an explicit valid legacy child id and never resolves by name", () => {
    const project = createEmptyProject("p", "Project");
    const raw = {
      ...project,
      schemaVersion: 7,
      documents: [
        {
          ...project.documents[0]!,
          id: "parent",
          instances: [
            {
              id: "X1",
              symbolId: "hierarchical-child",
              placement: null,
              properties: { "spice.childDocumentId": "child" },
              binding: {
                kind: "subcircuit",
                name: "Child",
                status: "resolved",
              },
              netlist: {
                reference: "X1",
                parameters: {},
                binding: { kind: "external-subcircuit", name: "Child" },
              },
            },
          ],
        },
        { ...project.documents[0]!, id: "child", name: "Child" },
      ],
      topDocumentId: "parent",
    };
    const migrated = migrateV7ToV8(raw);
    const instance = (
      (migrated.documents as Array<Record<string, unknown>>)[0]!
        .instances as Array<Record<string, unknown>>
    )[0]!;
    expect(instance).toMatchObject({
      netlist: {
        binding: {
          kind: "subcircuit",
          name: "Child",
          childDocumentId: "child",
        },
      },
    });

    const withoutId = structuredClone(raw);
    (
      (withoutId.documents[0] as Record<string, unknown>).instances as Array<
        Record<string, unknown>
      >
    )[0]!.properties = {};
    const unlinked = migrateV7ToV8(withoutId);
    expect(
      (
        (
          (unlinked.documents as Array<Record<string, unknown>>)[0]!
            .instances as Array<Record<string, unknown>>
        )[0]!.netlist as Record<string, unknown>
      ).binding,
    ).toEqual({ kind: "external-subcircuit", name: "Child" });
  });

  it("preserves a target-only legacy source fact without inventing its status", () => {
    const project = createEmptyProject("p", "Project");
    const migrated = migrateV7ToV8({
      ...project,
      schemaVersion: 7,
      documents: [
        {
          ...project.documents[0]!,
          instances: [
            {
              id: "R1",
              symbolId: "resistor",
              placement: null,
              properties: {
                "spice.name": "R1",
                "spice.target": "model:legacy_resistor",
              },
              netlist: { reference: "R1", parameters: {} },
            },
          ],
        },
      ],
    });
    const instance = (
      (migrated.documents as Array<Record<string, unknown>>)[0]!
        .instances as Array<Record<string, unknown>>
    )[0]!;
    expect(instance.importProvenance).toEqual({
      kind: "model",
      name: "legacy_resistor",
      sourceTarget: "model:legacy_resistor",
    });
  });

  it("rejects current spice.* properties and duplicate terminal facts", () => {
    const project = createEmptyProject("p", "Project");
    project.documents[0]!.instances = [
      {
        id: "R1",
        symbolId: "resistor",
        placement: null,
        properties: { "spice.name": "R1" },
        netlist: {
          reference: "R1",
          parameters: {},
          terminals: [
            { sourcePosition: 0, pinName: "1" },
            { sourcePosition: 0, pinName: "1" },
          ],
        },
      },
    ];
    const parsed = CircuitProjectSchema.safeParse(project);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          ["documents", 0, "instances", 0, "properties", "spice.name"],
          [
            "documents",
            0,
            "instances",
            0,
            "netlist",
            "terminals",
            1,
            "sourcePosition",
          ],
        ]),
      );
    }
  });

  it("writes a canonical schema-v8 Project after sequential migration", () => {
    const project = createEmptyProject("p", "Project");
    const legacy = JSON.stringify({ ...project, schemaVersion: 7 });
    const parsed = parseProject(legacy);
    expect(parsed.schemaVersion).toBe(8);
    expect(parseProject(serializeProject(parsed))).toEqual(parsed);
  });
});
