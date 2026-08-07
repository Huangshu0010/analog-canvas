import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
  deriveStableId,
} from "@icm/model";
import { resolvePdkSymbolMapping } from "@icm/symbols";
import type { PdkSymbolMappingOverride } from "@icm/symbols";
import type {
  CircuitProject,
  Instance,
  Net,
  SchematicDocument,
} from "@icm/model";

import type { SpiceCompileResult } from "./compiler.js";
import type { SpiceCompileOptions } from "./dialect.js";
import { diagnostic } from "./diagnostics.js";
import type { SpiceDiagnostic } from "./diagnostics.js";
import type { CircuitCellIR, CircuitIR, CircuitInstanceIR } from "./ir.js";
import type { SourceBundle, SpiceSourceInput } from "./source-types.js";
import { compileSpiceSources } from "./compiler.js";

export interface SpiceImportResult extends SpiceCompileResult {
  project: CircuitProject | null;
}

export interface SpiceImportOptions {
  symbolMappings?: readonly PdkSymbolMappingOverride[];
}

interface ImportSymbolMapping {
  symbolId: string;
  pinNames?: readonly string[];
  registryId?: string;
}

function symbolFor(
  instance: CircuitInstanceIR,
  modelTypeByName: ReadonlyMap<string, string>,
  symbolMappings: readonly PdkSymbolMappingOverride[],
): ImportSymbolMapping | null {
  if (instance.target.kind === "subcircuit") {
    return {
      symbolId: deriveStableId(
        "hierarchical-symbol",
        instance.target.cellName.toLowerCase(),
      ),
    };
  }
  if (instance.target.kind === "model") {
    const pdkMapping = resolvePdkSymbolMapping(
      instance.target.modelName,
      instance.terminals.length,
      symbolMappings,
    );
    if (pdkMapping) {
      return {
        symbolId: pdkMapping.symbolId,
        pinNames: pdkMapping.pinNames,
        registryId: pdkMapping.registryId,
      };
    }
    const modelType = modelTypeByName.get(
      instance.target.modelName.toLowerCase(),
    );
    if (
      instance.terminals.length === 2 &&
      (modelType === "d" || instance.name[0]?.toLowerCase() === "d")
    ) {
      return { symbolId: "diode", pinNames: ["A", "K"] };
    }
    if (instance.terminals.length === 3 && modelType === "npn")
      return { symbolId: "npn", pinNames: ["C", "B", "E"] };
    if (instance.terminals.length === 3 && modelType === "pnp")
      return { symbolId: "pnp", pinNames: ["C", "B", "E"] };
    if (instance.terminals.length === 4 && modelType === "nmos")
      return { symbolId: "nmos", pinNames: ["D", "G", "S", "B"] };
    if (instance.terminals.length === 4 && modelType === "pmos")
      return { symbolId: "pmos", pinNames: ["D", "G", "S", "B"] };
    return null;
  }
  if (instance.target.kind === "opaque") {
    const pdkMapping = resolvePdkSymbolMapping(
      instance.target.sourceName,
      instance.terminals.length,
      symbolMappings,
    );
    return pdkMapping
      ? {
          symbolId: pdkMapping.symbolId,
          pinNames: pdkMapping.pinNames,
          registryId: pdkMapping.registryId,
        }
      : null;
  }
  if (instance.target.kind !== "primitive") return null;
  const symbols: Record<string, string> = {
    resistor: "resistor",
    capacitor: "capacitor",
    inductor: "inductor",
    nmos: "nmos",
    pmos: "pmos",
    "voltage-source": "voltage-source",
    "current-source": "current-source",
    diode: "diode",
  };
  const symbolId = symbols[instance.target.family];
  return symbolId ? { symbolId } : null;
}

function targetDescription(
  instance: CircuitInstanceIR,
  symbolMappings: readonly PdkSymbolMappingOverride[],
): string {
  switch (instance.target.kind) {
    case "primitive":
      return `primitive:${instance.target.family}`;
    case "model":
      return `model:${instance.target.modelName}`;
    case "subcircuit":
      return `subcircuit:${instance.target.cellName}`;
    case "opaque":
      return resolvePdkSymbolMapping(
        instance.target.sourceName,
        instance.terminals.length,
        symbolMappings,
      )
        ? `model:${instance.target.sourceName}`
        : `opaque:${instance.target.sourceName}`;
  }
}

function importInstance(
  instance: CircuitInstanceIR,
  diagnostics: SpiceDiagnostic[],
  modelTypeByName: ReadonlyMap<string, string>,
  symbolMappings: readonly PdkSymbolMappingOverride[],
): Instance {
  const mapping = symbolFor(instance, modelTypeByName, symbolMappings);
  const symbolId =
    mapping?.symbolId ?? `generic-block-${instance.terminals.length}`;
  if (!mapping) {
    diagnostics.push(
      diagnostic(
        "SPICE_IMPORT_GENERIC_SYMBOL",
        "warning",
        "import",
        `No product symbol is mapped for ${instance.name} (${targetDescription(instance, symbolMappings)}); using generic-block`,
        instance.sourceRef,
      ),
    );
  }
  const properties: Instance["properties"] = {
    "spice.name": instance.name,
    "spice.target": targetDescription(instance, symbolMappings),
  };
  if (mapping?.registryId) {
    properties["symbol.mapping.registry"] = mapping.registryId;
  }
  for (const [key, parameter] of Object.entries(instance.parameters)) {
    properties[`spice.param.${key}`] = parameter.rawText;
  }
  for (const terminal of instance.terminals) {
    properties[`spice.pin.P${terminal.position + 1}`] =
      mapping?.pinNames?.[terminal.position] ??
      terminal.name ??
      `P${terminal.position + 1}`;
  }
  return {
    id: instance.id,
    symbolId,
    sourceRef: instance.sourceRef,
    placement: null,
    properties,
  };
}

function importDocument(
  cell: CircuitCellIR,
  diagnostics: SpiceDiagnostic[],
  modelTypeByName: ReadonlyMap<string, string>,
  symbolMappings: readonly PdkSymbolMappingOverride[],
): SchematicDocument {
  const visibleInstances = cell.instances.filter((instance) => {
    if (instance.terminals.length > 0) return true;
    diagnostics.push(
      diagnostic(
        "SPICE_IMPORT_NON_VISUAL_INSTANCE",
        "warning",
        "import",
        `Structural instance ${instance.name} has no electrical terminals and remains in transient Circuit IR only`,
        instance.sourceRef,
      ),
    );
    return false;
  });
  const instances = visibleInstances.map((instance) =>
    importInstance(instance, diagnostics, modelTypeByName, symbolMappings),
  );
  const importedInstanceById = new Map(
    instances.map((instance) => [instance.id, instance]),
  );
  const importedPorts = cell.ports.map((port) => ({
    source: port,
    id: deriveStableId("port", cell.name, String(port.position), port.name),
  }));
  const ports = importedPorts.map(({ source: port, id }) => ({
    id,
    name: port.name,
    direction: "passive" as const,
    position: null,
  }));
  const nets: Net[] = cell.nets.map((net) => ({
    id: net.id,
    name: net.name,
    scope: net.scope,
    terminals: visibleInstances.flatMap((instance) =>
      instance.terminals
        .filter((terminal) => terminal.netId === net.id)
        .map((terminal) => ({
          instanceId: instance.id,
          pinName: String(
            importedInstanceById.get(instance.id)?.properties[
              `spice.pin.P${terminal.position + 1}`
            ] ?? `P${terminal.position + 1}`,
          ),
        })),
    ),
    ports: importedPorts
      .filter(({ source: port }) => port.netId === net.id)
      .map(({ id }) => id),
  }));
  return {
    id: deriveStableId("document", cell.name.toLowerCase()),
    name: cell.name,
    revision: 0,
    sourceBinding: { cellName: cell.name, sourceRef: cell.sourceRef },
    sourceStatus: "in-sync",
    ports,
    instances,
    nets,
    routes: [],
    junctions: [],
    annotations: [],
    presentation: {
      styleProfileId: "textbook-monochrome-v1",
      grid: 10,
      compactness: "normal",
    },
    layoutGroups: [],
    constraints: [],
  };
}

function sourceProjectName(bundle: SourceBundle): string {
  const filename = bundle.entryPath.split("/").at(-1) ?? bundle.entryPath;
  return filename.replace(/\.[^.]+$/u, "") || "Imported SPICE";
}

export function importCircuitIR(
  ir: CircuitIR,
  bundle: SourceBundle,
  inputDiagnostics: readonly SpiceDiagnostic[] = [],
  options: SpiceImportOptions = {},
): { project: CircuitProject; diagnostics: SpiceDiagnostic[] } {
  const diagnostics = [...inputDiagnostics];
  const modelTypeByName = new Map(
    ir.models.map((model) => [
      model.name.toLowerCase(),
      model.modelType.toLowerCase(),
    ]),
  );
  const documents = ir.cells.map((cell) =>
    importDocument(
      cell,
      diagnostics,
      modelTypeByName,
      options.symbolMappings ?? [],
    ),
  );
  const topCell = ir.topCells[0] ?? ir.cells[0]?.name;
  const topDocument = documents.find(
    (document) =>
      document.sourceBinding?.cellName.toLowerCase() === topCell?.toLowerCase(),
  );
  if (!topDocument)
    throw new Error("Circuit IR has no importable top Document");
  const name = topCell ?? sourceProjectName(bundle);
  const entryHash = bundle.files.find(
    (file) => file.id === bundle.entryFileId,
  )?.hash;
  const project = CircuitProjectSchema.parse({
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    id: deriveStableId("project", bundle.entryPath, entryHash ?? "missing"),
    name: `${name} (SPICE Import)`,
    source: {
      entry: bundle.entryPath,
      dialect: ir.dialect,
      sourcePolicy: "copy",
      files: bundle.files.map((file) => ({
        id: file.id,
        path: file.path,
        hash: file.hash,
      })),
    },
    symbolLibrary: {
      id: "builtin-analog",
      version: "0.0.0",
      hash: "development",
    },
    topDocumentId: topDocument.id,
    documents,
  });
  return { project, diagnostics };
}

export function importCompileResult(
  result: SpiceCompileResult,
  options: SpiceImportOptions = {},
): SpiceImportResult {
  if (!result.ir) return { ...result, project: null };
  try {
    const imported = importCircuitIR(
      result.ir,
      result.bundle,
      result.diagnostics,
      options,
    );
    return {
      ...result,
      project: imported.project,
      diagnostics: imported.diagnostics,
      successful: !imported.diagnostics.some(
        (item) => item.severity === "error",
      ),
    };
  } catch (error) {
    const diagnostics = [
      ...result.diagnostics,
      diagnostic(
        "SPICE_IMPORT_INVALID_PROJECT",
        "error",
        "import",
        error instanceof Error ? error.message : String(error),
      ),
    ];
    return { ...result, project: null, diagnostics, successful: false };
  }
}

export async function importSpiceSources(
  inputs: readonly SpiceSourceInput[],
  entryPath: string,
  compileOptions: SpiceCompileOptions = {},
  importOptions: SpiceImportOptions = {},
): Promise<SpiceImportResult> {
  return importCompileResult(
    await compileSpiceSources(inputs, entryPath, compileOptions),
    importOptions,
  );
}
