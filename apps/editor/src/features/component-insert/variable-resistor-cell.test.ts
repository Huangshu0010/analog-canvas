import { createEmptyProject, CircuitProjectSchema } from "@icm/model";
import { executeProjectTransaction } from "@icm/edit-engine";
import { analyzeDesignNetlist, printSpiceNetlist } from "@icm/netlist";
import { describe, expect, it } from "vitest";

import {
  bindVariableResistorInstance,
  resolveVariableResistorCell,
} from "./variable-resistor-cell";

describe("variable resistor Cell", () => {
  it("reuses one child Cell and exports each placed symbol as an X subcircuit call", () => {
    let project = createEmptyProject("project", "Project");
    const first = resolveVariableResistorCell(project);

    expect(first.created).toBe(true);
    expect(first.document).toMatchObject({
      name: "Variable Resistor",
      netlist: {
        name: "VariableResistor",
        terminals: [{ name: "P1" }, { name: "P2" }],
        formalParameters: [{ name: "value", defaultValue: "10k" }],
      },
      instances: [
        expect.objectContaining({ symbolId: "port" }),
        expect.objectContaining({
          symbolId: "resistor",
          netlist: expect.objectContaining({
            reference: "R1",
            parameters: { value: "{value}" },
          }),
        }),
        expect.objectContaining({ symbolId: "port" }),
      ],
    });
    const placed = executeProjectTransaction(project, {
      transactionId: "place-variable-resistor",
      projectId: project.id,
      expectedStructureRevision: project.structureRevision,
      actor: { kind: "human", id: "test" },
      edits: [
        { kind: "add_document", document: first.document },
        {
          kind: "transact_document",
          documentId: project.topDocumentId,
          expectedRevision: 0,
          edits: [
            {
              kind: "add_instance",
              instance: bindVariableResistorInstance(
                {
                  id: "X1",
                  symbolId: "variable-resistor",
                  schematicReference: "X1",
                  placement: null,
                  netlist: {
                    reference: "X1",
                    parameters: { value: "25k" },
                  },
                },
                first.document.id,
              ),
            },
          ],
        },
      ],
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    project = placed.project;
    expect(resolveVariableResistorCell(project)).toEqual({
      document: project.documents.find(
        (document) => document.id === first.document.id,
      ),
      created: false,
    });

    const top = project.documents[0]!;
    top.nets.push(
      {
        id: "net-in",
        name: "VIN",
        scope: "local",
        terminals: [{ instanceId: "X1", pinName: "P1" }],
        origin: { kind: "authored" },
      },
      {
        id: "net-out",
        name: "VOUT",
        scope: "local",
        terminals: [{ instanceId: "X1", pinName: "P2" }],
        origin: { kind: "authored" },
      },
    );

    expect(CircuitProjectSchema.safeParse(project).success).toBe(true);
    const analysis = analyzeDesignNetlist(project);
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.ir).not.toBeNull();
    const spice = printSpiceNetlist(analysis.ir!);
    expect(spice).toContain(".subckt VariableResistor P1 P2 params: value=10k");
    expect(spice).toContain("R1 P1 P2 {value}");
    expect(spice).toContain("X1 VIN VOUT VariableResistor value=25k");
  });

  it("allocates a collision-free generated Cell name", () => {
    const project = createEmptyProject("project", "Project");
    project.documents[0]!.netlist!.name = "VariableResistor";

    expect(resolveVariableResistorCell(project).document.netlist?.name).toBe(
      "VariableResistor_2",
    );
  });
});
