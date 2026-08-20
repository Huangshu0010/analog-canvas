import { importSpiceSources } from "@icm/spice";
import { describe, expect, it } from "vitest";

import type { DesignNetlistIR } from "./ir.js";
import { analyzeDesignNetlist } from "./extract.js";
import { printSpiceNetlist } from "./printers.js";

function structuralIr(): DesignNetlistIR {
  return {
    topCellId: "top",
    globals: [],
    externalMasters: [
      {
        id: "external-master",
        name: "EXT_MASTER",
        terminals: [
          { id: "external-p1", name: "P1", direction: "passive" },
          { id: "external-p2", name: "P2", direction: "passive" },
        ],
        formalParameters: [],
      },
    ],
    cells: [
      {
        id: "leaf",
        name: "leaf",
        ports: ["A", "B"].map((name) => ({
          id: `leaf-${name}`,
          name,
          netName: name,
        })),
        nets: [],
        instances: [],
      },
      {
        id: "top",
        name: "top",
        ports: ["VIN", "VOUT"].map((name) => ({
          id: `top-${name}`,
          name,
          netName: name,
        })),
        nets: [],
        instances: [
          {
            id: "x1",
            reference: "X1",
            deviceClass: "hierarchical",
            target: "EXT_MASTER",
            nodes: [
              { pinName: "P1", netName: "VIN" },
              { pinName: "P2", netName: "VOUT" },
            ],
            parameters: [{ name: "l", rawValue: "1u" }],
          },
          {
            id: "x2",
            reference: "X2",
            deviceClass: "hierarchical",
            target: "leaf",
            nodes: [
              { pinName: "A", netName: "VOUT" },
              { pinName: "B", netName: "VIN" },
            ],
            parameters: [],
          },
        ],
      },
    ],
  };
}

function semanticCalls(ir: DesignNetlistIR) {
  return ir.cells.map((cell) => ({
    name: cell.name,
    ports: cell.ports.map((port) => port.netName),
    instances: cell.instances.map((instance) => ({
      reference: instance.reference,
      deviceClass: instance.deviceClass,
      target: instance.target,
      nodes: instance.nodes.map((node) => node.netName),
      parameters: instance.parameters,
    })),
  }));
}

describe("structural SPICE round trip", () => {
  it("preserves hierarchy, X-call target/order, and raw external parameters", async () => {
    const before = structuralIr();
    const imported = await importSpiceSources(
      [
        {
          path: "roundtrip.spi",
          bytes: new TextEncoder().encode(printSpiceNetlist(before)),
        },
      ],
      "roundtrip.spi",
    );

    expect(imported.successful).toBe(true);
    expect(imported.project).not.toBeNull();
    const after = analyzeDesignNetlist(imported.project!);
    expect(after.diagnostics).toEqual([]);
    expect(after.ir).not.toBeNull();
    expect(semanticCalls(after.ir!)).toEqual(semanticCalls(before));
    expect(after.ir!.externalMasters).toEqual([
      expect.objectContaining({ name: "EXT_MASTER" }),
    ]);
  });
});
