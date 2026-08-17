import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@icm/model";

import { extractDesignNetlist } from "./extract.js";

function resistorProject(parameters: Record<string, string>) {
  const project = createEmptyProject("project", "Project");
  const document = project.documents[0]!;
  document.instances.push({
    id: "R1",
    symbolId: "resistor",
    placement: null,
    properties: {},
    netlist: {
      reference: "R1",
      binding: { kind: "primitive", deviceClass: "resistor" },
      parameters,
    },
  });
  document.nets.push(
    {
      id: "net-in",
      name: "VIN",
      scope: "local",
      terminals: [{ instanceId: "R1", pinName: "1" }],
    },
    {
      id: "net-out",
      name: "VOUT",
      scope: "local",
      terminals: [{ instanceId: "R1", pinName: "2" }],
    },
  );
  return project;
}

describe("current formal cell interface", () => {
  it("maps private cell terminals to Nets without canvas Port objects", () => {
    const project = createEmptyProject("project", "Project");
    const document = project.documents[0]!;
    document.netlist = {
      name: "inverter",
      terminals: [
        { name: "VIN", netId: "net-in" },
        { name: "VOUT", netId: "net-out" },
      ],
    };
    document.nets.push(
      { id: "net-in", name: "VIN", scope: "local", terminals: [] },
      { id: "net-out", name: "VOUT", scope: "local", terminals: [] },
    );

    const result = extractDesignNetlist(project);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.cells[0]?.ports).toEqual([
      { id: "net-in", name: "VIN", netName: "VIN" },
      { id: "net-out", name: "VOUT", netName: "VOUT" },
    ]);
  });

  it("uses the same case-folded parameter identity as the deterministic printers", () => {
    const result = extractDesignNetlist(resistorProject({ Value: "10k" }));
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.cells[0]?.instances).toEqual([
      {
        id: "R1",
        reference: "R1",
        deviceClass: "resistor",
        target: null,
        nodes: [
          { pinName: "1", netName: "VIN" },
          { pinName: "2", netName: "VOUT" },
        ],
        parameters: [{ name: "Value", rawValue: "10k" }],
      },
    ]);
  });

  it("rejects parameters that would become ambiguous under case folding", () => {
    const result = extractDesignNetlist(
      resistorProject({ value: "10k", Value: "20k" }),
    );
    expect(result.ir).toBeNull();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "DUPLICATE_PARAMETER_NAME",
        objectIds: ["R1"],
        message: expect.stringContaining("parameter value"),
      }),
    ]);
  });

  it("reports the shared global-name contract violation", () => {
    const project = createEmptyProject("project", "Project");
    project.documents[0]!.nets.push({
      id: "net-global",
      scope: "global",
      terminals: [],
    });

    const result = extractDesignNetlist(project);

    expect(result.ir).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UNNAMED_GLOBAL_NET",
        objectIds: ["net-global"],
      }),
    );
  });
});
