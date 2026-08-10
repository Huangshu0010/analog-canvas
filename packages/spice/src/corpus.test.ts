import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CircuitProjectSchema } from "@icm/model";
import { describe, expect, it } from "vitest";

import { compileSourceBundle } from "./compiler.js";
import { importCompileResult } from "./importer.js";
import { loadSourceBundleFromFile } from "./node-source.js";

const entries = [
  "mixed-device-acceptance",
  "phase-9-heldout-chopper-afe-8ch",
  "phase-9-heldout-differential-ring-8stage",
  "phase-9-heldout-flash-adc-4bit",
  "rlc-broadband-50-to-200-match",
  "rlc-rf-bandpass-100mhz",
  "sky130-ota-5t-gain40-pm60-noise50uv-pvt",
  "sky130-switched-capacitor-dac-6bit-pvt",
  "sky130-thermometer-trim-resistor",
  "sky130-transistor-divide-by-2",
] as const;

function connectivityHash(
  ir: NonNullable<ReturnType<typeof compileSourceBundle>["ir"]>,
): string {
  const connectivity = ir.cells.map((cell) => ({
    name: cell.name,
    ports: cell.ports.map((port) => port.name),
    instances: cell.instances.map((instance) => ({
      name: instance.name,
      target: instance.target,
      terminals: instance.terminals.map((terminal) => ({
        pin: terminal.name,
        net: cell.nets.find((net) => net.id === terminal.netId)?.name,
      })),
    })),
  }));
  return createHash("sha256")
    .update(JSON.stringify(connectivity))
    .digest("hex");
}

describe("current netlist corpus", () => {
  it("compiles every entry and rejects unsupported Razavi devices explicitly", async () => {
    const summary = [];
    let totalInstances = 0;
    for (const directory of entries) {
      const entry = resolve(
        process.cwd(),
        "netlists",
        directory,
        "circuit.spi",
      );
      const compiled = compileSourceBundle(
        await loadSourceBundleFromFile(entry),
      );
      expect(
        compiled.diagnostics.filter((item) => item.severity === "error"),
        directory,
      ).toEqual([]);
      expect(compiled.ir, directory).not.toBeNull();
      const ir = compiled.ir!;
      const imported = importCompileResult(compiled);
      if (imported.project) {
        expect(
          CircuitProjectSchema.safeParse(imported.project).success,
          directory,
        ).toBe(true);
        expect(
          imported.project.documents
            .flatMap((document) => document.instances)
            .every((instance) => instance.placement === null),
          directory,
        ).toBe(true);
        expect(
          imported.project.documents
            .flatMap((document) => document.instances)
            .some((instance) => instance.symbolId.startsWith("generic-block-")),
          directory,
        ).toBe(false);
      } else {
        expect(
          imported.diagnostics.some(
            (item) =>
              item.code === "SPICE_IMPORT_UNSUPPORTED_SYMBOL" &&
              item.severity === "error",
          ),
          directory,
        ).toBe(true);
      }
      expect(ir.unresolvedStatements, directory).toEqual([]);
      expect(
        compiled.bundle.syntaxFiles.every(
          (file) => file.statements.length === file.logicalLines.length,
        ),
        directory,
      ).toBe(true);
      const instances = ir.cells.reduce(
        (count, cell) => count + cell.instances.length,
        0,
      );
      totalInstances += instances;
      summary.push({
        entry: directory,
        sourceFiles: compiled.bundle.files.map((file) => file.path),
        topCells: ir.topCells,
        cells: ir.cells.length,
        ports: ir.cells.reduce((count, cell) => count + cell.ports.length, 0),
        nets: ir.cells.reduce((count, cell) => count + cell.nets.length, 0),
        instances,
        models: ir.models.length,
        parameters:
          ir.parameters.length +
          ir.cells.reduce((count, cell) => count + cell.parameters.length, 0),
        genericSymbols: 0,
        connectivitySha256: connectivityHash(ir),
      });
    }
    expect(totalInstances).toBe(215);
    const golden = JSON.parse(
      await readFile(
        resolve(process.cwd(), "fixtures/spice/current-corpus-summary.json"),
        "utf8",
      ),
    );
    expect(summary).toEqual(golden);
  });
});
