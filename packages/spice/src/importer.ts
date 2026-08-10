import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
  deriveStableId,
} from "@icm/model";
import { isRazaviProductSymbolId, resolvePdkSymbolMapping } from "@icm/symbols";
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
    if (instance.terminals.length === 2 && modelType === "d")
      return { symbolId: "diode", pinNames: ["A", "K"] };
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
  const symbols: Record<string, ImportSymbolMapping> = {
    resistor: { symbolId: "resistor" },
    capacitor: { symbolId: "capacitor" },
    inductor: { symbolId: "inductor" },
    nmos: { symbolId: "nmos" },
    pmos: { symbolId: "pmos" },
    "voltage-source": { symbolId: "voltage-source" },
    "current-source": { symbolId: "current-source" },
    vccs: {
      symbolId: "vccs",
      pinNames: ["OUT+", "OUT-", "CTRL+", "CTRL-"],
    },
  };
  const mapping = symbols[instance.target.family];
  return mapping && isRazaviProductSymbolId(mapping.symbolId) ? mapping : null;
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
): Instance | null {
  const mapping = symbolFor(instance, modelTypeByName, symbolMappings);
  if (!mapping) {
    diagnostics.push(
      diagnostic(
        "SPICE_IMPORT_UNSUPPORTED_SYMBOL",
        "error",
        "import",
        `Unsupported SPICE device ${instance.name} (${targetDescription(instance, symbolMappings)}): the approved Razavi catalog has no symbol. Add and review a Razavi symbol mapping before importing.`,
        instance.sourceRef,
      ),
    );
    return null;
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
    symbolId: mapping.symbolId,
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
  const instances = visibleInstances
    .map((instance) =>
      importInstance(instance, diagnostics, modelTypeByName, symbolMappings),
    )
    .filter((instance): instance is Instance => instance !== null);
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
    terminals: visibleInstances
      .filter((instance) => importedInstanceById.has(instance.id))
      .flatMap((instance) =>
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
      styleProfileId: "razavi-textbook-v1",
      grid: 10,
      compactness: "normal",
    },
    layoutGroups: [],
    constraints: [],
  };
}

/**
 * Records a stable document link for an imported `X` instance. `spice.target`
 * remains the source-fidelity description; the ID is solely the imported
 * Project's navigation reference and avoids resolving hierarchy by a mutable
 * cell name at runtime.
 */
function bindImportedChildDocuments(
  documents: readonly SchematicDocument[],
): SchematicDocument[] {
  const documentIdByCellName = new Map(
    documents.flatMap((document) => {
      const cellName = document.sourceBinding?.cellName;
      return cellName ? [[cellName.toLowerCase(), document.id] as const] : [];
    }),
  );
  return documents.map((document) => ({
    ...document,
    instances: document.instances.map((instance) => {
      const target = instance.properties["spice.target"];
      if (typeof target !== "string" || !target.startsWith("subcircuit:")) {
        return instance;
      }
      const childDocumentId = documentIdByCellName.get(
        target.slice("subcircuit:".length).toLowerCase(),
      );
      if (!childDocumentId) return instance;
      return {
        ...instance,
        properties: {
          ...instance.properties,
          "spice.childDocumentId": childDocumentId,
        },
      };
    }),
  }));
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
  const importedDocuments = ir.cells.map((cell) =>
    importDocument(
      cell,
      diagnostics,
      modelTypeByName,
      options.symbolMappings ?? [],
    ),
  );
  const documents = bindImportedChildDocuments(importedDocuments);
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
      id: "razavi-symbols",
      version: "1",
      hash: "razavi-reference-v1",
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
    const hasErrors = imported.diagnostics.some(
      (item) => item.severity === "error",
    );
    return {
      ...result,
      project: hasErrors ? null : imported.project,
      diagnostics: imported.diagnostics,
      successful: !hasErrors,
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
