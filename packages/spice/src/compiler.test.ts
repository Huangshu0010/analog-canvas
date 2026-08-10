import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { compileSourceBundle, compileSpiceSources } from "./compiler.js";
import { importCompileResult } from "./importer.js";
import { loadSourceBundleFromFile } from "./node-source.js";

describe("SPICE elaboration and Project import", () => {
  it("imports reviewed diode, BJT, and four-terminal VCCS contracts", async () => {
    const source = Buffer.from(`
.model DREF D
.model QNREF NPN
.model QPREF PNP
D1 anode 0 DREF
Q1 collector base emitter QNREF
Q2 collector base emitter QPREF
G1 out 0 ctrl 0 1m
.end
`);
    const imported = importCompileResult(
      await compileSpiceSources(
        [{ path: "common.cir", bytes: source }],
        "common.cir",
      ),
    );
    expect(imported.successful).toBe(true);
    expect(
      imported.project?.documents[0]?.instances.map((instance) => [
        instance.properties["spice.name"],
        instance.symbolId,
      ]),
    ).toEqual([
      ["D1", "diode"],
      ["Q1", "npn"],
      ["Q2", "pnp"],
      ["G1", "vccs"],
    ]);
    expect(
      imported.project?.documents[0]?.instances.at(-1)?.properties,
    ).toMatchObject({
      "spice.pin.P1": "OUT+",
      "spice.pin.P2": "OUT-",
      "spice.pin.P3": "CTRL+",
      "spice.pin.P4": "CTRL-",
    });
  });

  it("preserves mixed-device IR but rejects devices outside the Razavi catalog", async () => {
    const entry = resolve(
      process.cwd(),
      "netlists/mixed-device-acceptance/circuit.spi",
    );
    const compiled = compileSourceBundle(await loadSourceBundleFromFile(entry));
    expect(compiled.successful).toBe(true);
    expect(compiled.ir).not.toBeNull();
    const ir = compiled.ir!;
    expect(ir.topCells).toEqual(["mixed_device_acceptance"]);
    expect(ir.cells).toHaveLength(8);
    expect(ir.parameters.map((item) => [item.name, item.rawText])).toEqual([
      ["RBASE", "4.7k"],
      ["CCOMP", "2p"],
      ["LISO", "8n"],
    ]);
    expect(ir.models.map((item) => [item.name, item.modelType])).toEqual([
      ["DACC", "D"],
      ["QNACC", "NPN"],
      ["QPACC", "PNP"],
      ["SWACC", "SW"],
    ]);
    const top = ir.cells.find(
      (cell) => cell.name === "mixed_device_acceptance",
    )!;
    expect(top.instances).toHaveLength(7);
    expect(top.instances[0]!.target).toEqual({
      kind: "subcircuit",
      cellName: "mixed_passive_cell",
    });
    expect(
      top.instances[0]!.terminals.map((terminal) => terminal.name),
    ).toEqual(["IN", "OUT", "VSS"]);

    const imported = importCompileResult(compiled);
    expect(imported.successful).toBe(false);
    expect(imported.project).toBeNull();
    const unsupported = imported.diagnostics.filter(
      (item) => item.code === "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
    );
    expect(unsupported.length).toBeGreaterThan(0);
    expect(unsupported.every((item) => item.severity === "error")).toBe(true);
    expect(unsupported.some((item) => item.message.includes("Razavi"))).toBe(
      true,
    );
  });

  it("imports reviewed inductors with the PDF-derived Razavi symbol", async () => {
    const entry = resolve(
      process.cwd(),
      "netlists/rlc-broadband-50-to-200-match/circuit.spi",
    );
    const imported = importCompileResult(
      compileSourceBundle(await loadSourceBundleFromFile(entry)),
    );
    expect(imported.project).not.toBeNull();
    expect(imported.successful).toBe(true);
    expect(
      imported.project?.documents[0]?.instances
        .filter((instance) => instance.symbolId === "inductor")
        .map((instance) => instance.properties["spice.name"]),
    ).toEqual(["L1", "L2"]);
  });

  it("normalizes reviewed SKY130 MOS models without losing source facts", async () => {
    const entry = resolve(
      process.cwd(),
      "netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/circuit.spi",
    );
    const imported = importCompileResult(
      compileSourceBundle(await loadSourceBundleFromFile(entry)),
    );
    expect(imported.successful).toBe(true);
    expect(
      imported.diagnostics.filter(
        (diagnostic) => diagnostic.code === "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
      ),
    ).toEqual([]);
    const document = imported.project!.documents[0]!;
    expect(document.instances.map((instance) => instance.symbolId)).toEqual([
      "nmos",
      "nmos",
      "pmos",
      "pmos",
      "nmos",
      "nmos",
    ]);
    expect(document.instances[0]!.properties).toMatchObject({
      "spice.target": "model:sky130_fd_pr__nfet_01v8",
      "spice.param.l": "1.0",
      "spice.param.w": "96",
      "spice.pin.P1": "D",
      "spice.pin.P2": "G",
      "spice.pin.P3": "S",
      "spice.pin.P4": "B",
      "symbol.mapping.registry": "sky130-nfet-four-terminal",
    });
    expect(
      document.nets
        .flatMap((net) => net.terminals)
        .filter((terminal) => terminal.instanceId === "XM1")
        .map((terminal) => terminal.pinName),
    ).toEqual(expect.arrayContaining(["D", "G", "S", "B"]));
  });

  it("ignores an explicit mapping to a removed compatibility symbol", async () => {
    const entry = resolve(
      process.cwd(),
      "netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/circuit.spi",
    );
    const imported = importCompileResult(
      compileSourceBundle(await loadSourceBundleFromFile(entry)),
      {
        symbolMappings: [
          {
            modelName: "sky130_fd_pr__nfet_01v8",
            terminalCount: 4,
            symbolId: "generic-block-4",
            pinNames: ["DRAIN", "GATE", "SOURCE", "BULK"],
            registryId: "project:reviewed-nfet",
          },
        ],
      },
    );
    const document = imported.project!.documents[0]!;
    const instance = document.instances.find(
      (candidate) => candidate.properties["spice.name"] === "XM1",
    )!;
    expect(instance).toMatchObject({
      symbolId: "nmos",
      properties: {
        "spice.pin.P1": "D",
        "spice.pin.P2": "G",
        "spice.pin.P3": "S",
        "spice.pin.P4": "B",
        "symbol.mapping.registry": "sky130-nfet-four-terminal",
      },
    });
    expect(
      imported.diagnostics.filter(
        (diagnostic) => diagnostic.code === "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
      ),
    ).toEqual([]);
  });
});
