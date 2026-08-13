import {
  createEmptyDocument,
  createEmptyProject,
  type CircuitProject,
  type SchematicDocument,
} from "@icm/model";
import { describe, expect, it } from "vitest";

import { extractDesignNetlist } from "./extract.js";

function resistorCell(): CircuitProject {
  const project = createEmptyProject("project-netlist", "Netlist");
  const document = project.documents[0]!;
  document.netlist = { name: "divider", portOrder: ["pin", "pout"] };
  document.ports.push(
    { id: "pin", name: "vin", direction: "input", position: null },
    { id: "pout", name: "vout", direction: "output", position: null },
  );
  document.instances.push({
    id: "resistor-1",
    symbolId: "resistor",
    placement: { position: { x: 10, y: 20 }, rotation: 0, mirror: "none" },
    properties: { value: "10k" },
    netlist: {
      reference: "R1",
      binding: { kind: "primitive", deviceClass: "resistor" },
      parameters: { value: "10k" },
    },
  });
  document.nets.push(
    {
      id: "net-in",
      name: "vin",
      scope: "local",
      terminals: [{ instanceId: "resistor-1", pinName: "1" }],
      ports: ["pin"],
    },
    {
      id: "net-out",
      scope: "local",
      terminals: [{ instanceId: "resistor-1", pinName: "2" }],
      ports: ["pout"],
    },
  );
  return project;
}

function appendChild(project: CircuitProject): SchematicDocument {
  const child = createEmptyDocument("document-child", "Child");
  child.netlist = { name: "child", portOrder: ["child-a", "child-b"] };
  child.ports.push(
    { id: "child-a", name: "a", direction: "input", position: null },
    { id: "child-b", name: "b", direction: "output", position: null },
  );
  child.noConnects.push(
    { id: "nc-a", endpoint: { kind: "port", portId: "child-a" } },
    { id: "nc-b", endpoint: { kind: "port", portId: "child-b" } },
  );
  project.documents.push(child);
  return child;
}

describe("extractDesignNetlist", () => {
  it("extracts deterministic structural IR and ignores presentation", () => {
    const project = resistorCell();
    const first = extractDesignNetlist(project);
    expect(first.diagnostics).toEqual([
      expect.objectContaining({
        code: "GENERATED_NET_NAME",
        severity: "warning",
        objectIds: ["net-out"],
      }),
    ]);
    expect(first.ir).toMatchObject({
      topCellId: "document-main",
      globals: [],
      cells: [
        {
          name: "divider",
          ports: [
            { id: "pin", name: "vin", netName: "vin" },
            { id: "pout", name: "vout", netName: "N0001" },
          ],
          instances: [
            {
              reference: "R1",
              deviceClass: "resistor",
              target: null,
              nodes: [
                { pinName: "1", netName: "vin" },
                { pinName: "2", netName: "N0001" },
              ],
              parameters: [{ name: "value", rawValue: "10k" }],
            },
          ],
        },
      ],
    });
    project.documents[0]!.instances[0]!.placement = {
      position: { x: 900, y: -700 },
      rotation: 270,
      mirror: "x",
    };
    project.documents[0]!.annotations.push({
      id: "decorative-label",
      kind: "instance-label",
      content: { runs: [{ kind: "text", value: "does not affect export" }] },
      anchor: {
        kind: "object",
        objectId: "resistor-1",
        localOffset: { x: 0, y: 0 },
        fallbackPosition: { x: 3, y: 4 },
      },
      alignment: "start",
      rotation: 0,
      locked: false,
    });
    expect(extractDesignNetlist(project)).toEqual(first);
  });

  it("returns dependency-first hierarchy with child interface node order", () => {
    const project = createEmptyProject("p", "P");
    const top = project.documents[0]!;
    top.netlist = { name: "top", portOrder: ["top-a", "top-b"] };
    top.ports.push(
      { id: "top-a", name: "in", direction: "input", position: null },
      { id: "top-b", name: "out", direction: "output", position: null },
    );
    top.instances.push({
      id: "child-instance",
      symbolId: "hierarchical-block",
      placement: null,
      properties: {},
      netlist: {
        reference: "X1",
        binding: {
          kind: "subcircuit",
          childDocumentId: "document-child",
          name: "child",
        },
        parameters: {},
      },
    });
    top.nets.push(
      {
        id: "a-net",
        name: "input_net",
        scope: "local",
        terminals: [{ instanceId: "child-instance", pinName: "a" }],
        ports: ["top-a"],
      },
      {
        id: "b-net",
        name: "output_net",
        scope: "local",
        terminals: [{ instanceId: "child-instance", pinName: "b" }],
        ports: ["top-b"],
      },
    );
    appendChild(project);

    const result = extractDesignNetlist(project);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.cells.map((cell) => cell.name)).toEqual(["child", "top"]);
    expect(result.ir?.cells[1]!.instances[0]).toMatchObject({
      reference: "X1",
      deviceClass: "hierarchical",
      target: "child",
      nodes: [
        { pinName: "a", netName: "input_net" },
        { pinName: "b", netName: "output_net" },
      ],
    });
  });

  it("blocks missing model, required parameters, pins, and invalid globals", () => {
    const project = createEmptyProject("p", "P");
    const document = project.documents[0]!;
    document.netlist = { name: "bad-cell", portOrder: [] };
    document.instances.push({
      id: "mos-1",
      symbolId: "nmos",
      placement: null,
      properties: {},
      netlist: { reference: "Q1", parameters: { "bad-name!": "2u" } },
    });
    document.nets.push({
      id: "global-unnamed",
      scope: "global",
      terminals: [{ instanceId: "missing-instance", pinName: "Z" }],
      ports: ["missing-port"],
    });

    const result = extractDesignNetlist(project);
    expect(result.ir).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "INVALID_CELL_NAME",
        "INVALID_PARAMETER_NAME",
        "MISSING_MODEL_TARGET",
        "MISSING_PIN_NET",
        "MISSING_REQUIRED_PARAMETER",
        "UNNAMED_GLOBAL_NET",
        "UNKNOWN_NET_PORT",
        "UNKNOWN_TERMINAL_INSTANCE",
        "WRONG_REFERENCE_PREFIX",
      ]),
    );
  });

  it("blocks hierarchy cycles and mismatched child names", () => {
    const project = createEmptyProject("p", "P");
    const top = project.documents[0]!;
    top.netlist = { name: "top", portOrder: [] };
    const child = appendChild(project);
    child.noConnects = [];
    child.netlist = { name: "child", portOrder: [] };
    child.ports = [];
    top.instances.push({
      id: "to-child",
      symbolId: "hierarchical-block",
      placement: null,
      properties: {},
      netlist: {
        reference: "X1",
        binding: {
          kind: "subcircuit",
          childDocumentId: child.id,
          name: "wrong_child",
        },
        parameters: {},
      },
    });
    child.instances.push({
      id: "to-top",
      symbolId: "hierarchical-block",
      placement: null,
      properties: {},
      netlist: {
        reference: "X2",
        binding: {
          kind: "subcircuit",
          childDocumentId: top.id,
          name: "top",
        },
        parameters: {},
      },
    });

    const result = extractDesignNetlist(project);
    expect(result.ir).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["CHILD_NAME_MISMATCH", "HIERARCHY_CYCLE"]),
    );
  });
});
