import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { compileSourceBundle, compileSpiceSources } from "./compiler.js";
import { importCompileResult } from "./importer.js";
import { loadSourceBundleFromFile } from "./node-source.js";

describe("SPICE elaboration and Project import", () => {
  it("imports reviewed diode and BJT contracts", async () => {
    const source = Buffer.from(`
.model DREF D
.model QNREF NPN
.model QPREF PNP
D1 anode 0 DREF
Q1 collector base emitter QNREF
Q2 collector base emitter QPREF
.end
`);
    const imported = importCompileResult(
      await compileSpiceSources(
        [{ path: "common.cir", bytes: source }],
        "common.cir",
      ),
    );
    expect(imported.successful).toBe(true);
    expect(imported.project?.documents[0]?.netlist).toMatchObject({
      name: "__flat__",
      terminals: [],
    });
    expect(imported.project?.documents[0]?.flightlineGuidance).toBe("active");
    expect(
      imported.project?.documents[0]?.instances.map((instance) => [
        instance.netlist?.reference,
        instance.symbolId,
        instance.importProvenance,
      ]),
    ).toEqual([
      [
        "D1",
        "diode",
        expect.objectContaining({
          kind: "model",
          name: "DREF",
          status: "resolved",
          modelType: "d",
        }),
      ],
      [
        "Q1",
        "npn",
        expect.objectContaining({
          kind: "model",
          name: "QNREF",
          status: "resolved",
          modelType: "npn",
        }),
      ],
      [
        "Q2",
        "pnp",
        expect.objectContaining({
          kind: "model",
          name: "QPREF",
          status: "resolved",
          modelType: "pnp",
        }),
      ],
    ]);
  });

  it("keeps SPICE G syntax in IR but rejects it without a reviewed product symbol", async () => {
    const compiled = await compileSpiceSources(
      [
        {
          path: "vccs.cir",
          bytes: Buffer.from("VCCS syntax test\nG1 out 0 ctrl 0 1m\n.end\n"),
        },
      ],
      "vccs.cir",
    );
    expect(compiled.successful).toBe(true);
    const vccs = compiled.ir?.cells
      .flatMap((cell) => cell.instances)
      .find(
        (instance) =>
          instance.target.kind === "primitive" &&
          instance.target.family === "vccs",
      );
    expect(vccs?.target).toEqual({
      kind: "primitive",
      family: "vccs",
    });
    const imported = importCompileResult(compiled);
    expect(imported.successful).toBe(false);
    expect(imported.project).toBeNull();
    expect(imported.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
          message: expect.stringContaining("primitive:vccs"),
        }),
      ]),
    );
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
        .map((instance) => instance.netlist?.reference),
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
    expect(document.instances[0]!.properties).toEqual({
      "symbol.mapping.registry": "sky130-nfet-four-terminal",
    });
    expect(document.instances[0]!.importProvenance).toMatchObject({
      // SKY130 uses an external PDK model name: the compiler preserves it as
      // opaque IR and the reviewed registry supplies the successful mapping.
      kind: "opaque",
      name: "sky130_fd_pr__nfet_01v8",
      status: "resolved",
      sourceTarget: "model:sky130_fd_pr__nfet_01v8",
    });
    expect(document.instances[0]!.netlist).toEqual({
      reference: "XM1",
      binding: {
        kind: "model",
        deviceClass: "mos",
        name: "sky130_fd_pr__nfet_01v8",
      },
      parameters: { l: "1.0", w: "96", nf: "12" },
      terminals: [
        { sourcePosition: 0, pinName: "D" },
        { sourcePosition: 1, pinName: "G" },
        { sourcePosition: 2, pinName: "S" },
        { sourcePosition: 3, pinName: "B" },
      ],
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
      (candidate) => candidate.netlist?.reference === "XM1",
    )!;
    expect(instance).toMatchObject({
      symbolId: "nmos",
      properties: {
        "symbol.mapping.registry": "sky130-nfet-four-terminal",
      },
      netlist: expect.objectContaining({
        terminals: [
          { sourcePosition: 0, pinName: "D" },
          { sourcePosition: 1, pinName: "G" },
          { sourcePosition: 2, pinName: "S" },
          { sourcePosition: 3, pinName: "B" },
        ],
      }),
    });
    expect(
      imported.diagnostics.filter(
        (diagnostic) => diagnostic.code === "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
      ),
    ).toEqual([]);
  });
});
