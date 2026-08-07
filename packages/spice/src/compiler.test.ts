import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

import {
  CircuitProjectSchema,
  deriveStableId,
  serializeProject,
} from "@icm/model";
import { describe, expect, it } from "vitest";

import { compileSourceBundle } from "./compiler.js";
import { importCompileResult } from "./importer.js";
import { loadSourceBundleFromFile } from "./node-source.js";

describe("SPICE elaboration and Project import", () => {
  it("preserves the mixed-device hierarchy, parameters, models, and connectivity", async () => {
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
    expect(imported.project).not.toBeNull();
    expect(CircuitProjectSchema.parse(imported.project)).toEqual(
      imported.project,
    );
    expect(imported.project!.source.files.map((file) => file.path)).toEqual([
      "circuit.spi",
      "models.inc",
    ]);
    expect(imported.project!.documents).toHaveLength(8);
    const importedTop = imported.project!.documents.find(
      (document) => document.name === "mixed_device_acceptance",
    )!;
    const importedFilter = importedTop.instances.find(
      (instance) => instance.id === "XFILTER",
    )!;
    expect(importedFilter.symbolId).toBe(
      deriveStableId("hierarchical-symbol", "mixed_passive_cell"),
    );
    expect(importedFilter.properties["spice.pin.P1"]).toBe("IN");
    expect(
      importedTop.nets
        .flatMap((net) => net.terminals)
        .find((terminal) => terminal.instanceId === "XFILTER")?.pinName,
    ).toBe("IN");
    expect(
      imported
        .project!.documents.flatMap((document) => document.instances)
        .every((instance) => instance.placement === null),
    ).toBe(true);
    expect(
      imported.diagnostics.some(
        (item) =>
          item.code === "SPICE_IMPORT_GENERIC_SYMBOL" &&
          item.message.includes("XFILTER"),
      ),
    ).toBe(false);
  });

  it("matches the canonical imported Project golden", async () => {
    const entry = resolve(
      process.cwd(),
      "netlists/rlc-broadband-50-to-200-match/circuit.spi",
    );
    const imported = importCompileResult(
      compileSourceBundle(await loadSourceBundleFromFile(entry)),
    );
    const golden = await readFile(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-2-imported-rlc/project.icproj.json",
      ),
      "utf8",
    );
    expect(serializeProject(imported.project!)).toBe(golden);
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
        (diagnostic) => diagnostic.code === "SPICE_IMPORT_GENERIC_SYMBOL",
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

  it("applies an explicit model mapping before the built-in PDK rule", async () => {
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
      symbolId: "generic-block-4",
      properties: {
        "spice.pin.P1": "DRAIN",
        "spice.pin.P2": "GATE",
        "spice.pin.P3": "SOURCE",
        "spice.pin.P4": "BULK",
        "symbol.mapping.registry": "project:reviewed-nfet",
      },
    });
    expect(
      imported.diagnostics.filter(
        (diagnostic) => diagnostic.code === "SPICE_IMPORT_GENERIC_SYMBOL",
      ),
    ).toEqual([]);
  });
});
