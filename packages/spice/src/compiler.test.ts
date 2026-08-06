import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

import { CircuitProjectSchema, serializeProject } from "@icm/model";
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
    expect(importedFilter.symbolId).toBe("generic-block-3");
    expect(importedFilter.properties["spice.pin.P1"]).toBe("IN");
    expect(
      importedTop.nets
        .flatMap((net) => net.terminals)
        .find((terminal) => terminal.instanceId === "XFILTER")?.pinName,
    ).toBe("P1");
    expect(
      imported
        .project!.documents.flatMap((document) => document.instances)
        .every((instance) => instance.placement === null),
    ).toBe(true);
    expect(
      imported.diagnostics.some(
        (item) => item.code === "SPICE_IMPORT_GENERIC_SYMBOL",
      ),
    ).toBe(true);
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
});
