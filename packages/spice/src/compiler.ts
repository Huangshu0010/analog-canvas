import { deriveStableId } from "@icm/model";
import type { SourceSpan } from "@icm/model";

import { diagnostic } from "./diagnostics.js";
import type { SpiceDiagnostic } from "./diagnostics.js";
import { CircuitIRSchema } from "./ir.js";
import type {
  CircuitCellIR,
  CircuitIR,
  CircuitInstanceIR,
  CircuitInstanceTargetIRSchema,
  CircuitNetIR,
  CircuitParameterDeclarationIR,
  ModelDeclarationIR,
  OpaqueStatement,
} from "./ir.js";
import { createSourceBundle } from "./source.js";
import type { SourceBundle, SpiceSourceInput } from "./source-types.js";
import type {
  InstanceStatement,
  OpaqueSyntaxStatement,
  RawSpiceParameter,
  SpiceStatement,
} from "./syntax.js";
import type { z } from "zod";

type CircuitTarget = z.infer<typeof CircuitInstanceTargetIRSchema>;

interface CellDefinition {
  name: string;
  ports: string[];
  parameters: RawSpiceParameter[];
  instances: InstanceStatement[];
  sourceRef: SourceSpan;
}

export interface SpiceCompileResult {
  bundle: SourceBundle;
  ir: CircuitIR | null;
  diagnostics: SpiceDiagnostic[];
  successful: boolean;
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}

function fullSpan(start: SourceSpan, end: SourceSpan): SourceSpan {
  if (start.fileId !== end.fileId) return start;
  return { fileId: start.fileId, start: start.start, end: end.end };
}

function declaration(
  parameter: RawSpiceParameter,
): CircuitParameterDeclarationIR {
  return {
    name: parameter.name,
    rawText: parameter.rawText,
    sourceRef: parameter.sourceRef,
  };
}

function opaqueIr(statement: OpaqueSyntaxStatement): OpaqueStatement {
  return {
    kind: "opaque",
    rawText: statement.rawText,
    sourceRef: statement.sourceRef,
    ...(statement.probableType ? { probableType: statement.probableType } : {}),
  };
}

function collectDefinitions(
  bundle: SourceBundle,
  diagnostics: SpiceDiagnostic[],
): {
  definitions: CellDefinition[];
  parameters: CircuitParameterDeclarationIR[];
  models: ModelDeclarationIR[];
  globalNames: Set<string>;
  opaque: OpaqueStatement[];
} {
  const definitions: CellDefinition[] = [];
  const parameters: CircuitParameterDeclarationIR[] = [];
  const models: ModelDeclarationIR[] = [];
  const globalNames = new Set(["0"]);
  const opaque: OpaqueStatement[] = [];
  const topInstances: InstanceStatement[] = [];

  for (const syntaxFile of bundle.syntaxFiles) {
    let current: CellDefinition | null = null;
    for (const statement of syntaxFile.statements) {
      switch (statement.kind) {
        case "include":
          break;
        case "subckt_start":
          if (current) {
            diagnostics.push(
              diagnostic(
                "SPICE_BIND_NESTED_SUBCKT",
                "error",
                "bind",
                `Nested subcircuit ${statement.name} is not valid`,
                statement.sourceRef,
                [{ message: "Open subcircuit", sourceRef: current.sourceRef }],
              ),
            );
            definitions.push(current);
          }
          current = {
            name: statement.name,
            ports: statement.ports,
            parameters: [...statement.parameters],
            instances: [],
            sourceRef: statement.sourceRef,
          };
          break;
        case "subckt_end":
          if (!current) {
            diagnostics.push(
              diagnostic(
                "SPICE_BIND_UNMATCHED_ENDS",
                "error",
                "bind",
                "Subcircuit end has no matching start",
                statement.sourceRef,
              ),
            );
            opaque.push({
              kind: "opaque",
              rawText: statement.rawText,
              sourceRef: statement.sourceRef,
              probableType: "directive",
            });
            break;
          }
          if (
            statement.name &&
            normalizeName(statement.name) !== normalizeName(current.name)
          ) {
            diagnostics.push(
              diagnostic(
                "SPICE_BIND_ENDS_MISMATCH",
                "error",
                "bind",
                `.ends ${statement.name} does not match .subckt ${current.name}`,
                statement.sourceRef,
                [{ message: "Subcircuit start", sourceRef: current.sourceRef }],
              ),
            );
          }
          current.sourceRef = fullSpan(current.sourceRef, statement.sourceRef);
          definitions.push(current);
          current = null;
          break;
        case "parameter":
          if (current) current.parameters.push(...statement.parameters);
          else parameters.push(...statement.parameters.map(declaration));
          break;
        case "model":
          models.push({
            name: statement.name,
            modelType: statement.modelType,
            rawParameters: statement.rawParameters,
            sourceRef: statement.sourceRef,
          });
          break;
        case "global":
          for (const name of statement.names)
            globalNames.add(normalizeName(name));
          break;
        case "instance":
          if (current) current.instances.push(statement);
          else topInstances.push(statement);
          break;
        case "opaque":
          opaque.push(opaqueIr(statement));
          break;
      }
    }
    if (current) {
      diagnostics.push(
        diagnostic(
          "SPICE_BIND_UNTERMINATED_SUBCKT",
          "error",
          "bind",
          `Subcircuit ${current.name} has no matching .ends`,
          current.sourceRef,
        ),
      );
      definitions.push(current);
    }
  }

  if (topInstances.length > 0) {
    definitions.push({
      name: "__flat__",
      ports: [],
      parameters: [],
      instances: topInstances,
      sourceRef: fullSpan(
        topInstances[0]!.sourceRef,
        topInstances.at(-1)!.sourceRef,
      ),
    });
  }
  return { definitions, parameters, models, globalNames, opaque };
}

function parameterRecord(
  parameters: RawSpiceParameter[],
  controlSource?: string,
): CircuitInstanceIR["parameters"] {
  const result: CircuitInstanceIR["parameters"] = {};
  const occurrences = new Map<string, number>();
  const add = (name: string, rawText: string): void => {
    const normalizedName = normalizeName(name);
    const occurrence = (occurrences.get(normalizedName) ?? 0) + 1;
    occurrences.set(normalizedName, occurrence);
    const key =
      occurrence === 1 ? normalizedName : `${normalizedName}#${occurrence}`;
    result[key] = { normalizedName, rawText };
  };
  for (const parameter of parameters) add(parameter.name, parameter.rawText);
  if (controlSource) add("control-source", controlSource);
  return result;
}

function defaultPinNames(statement: InstanceStatement): string[] {
  const byFamily: Partial<Record<InstanceStatement["family"], string[]>> = {
    resistor: ["1", "2"],
    capacitor: ["1", "2"],
    inductor: ["1", "2"],
    "voltage-source": ["+", "-"],
    "current-source": ["+", "-"],
    vcvs: ["OUT+", "OUT-", "CTRL+", "CTRL-"],
    vccs: ["OUT+", "OUT-", "CTRL+", "CTRL-"],
    cccs: ["OUT+", "OUT-"],
    ccvs: ["OUT+", "OUT-"],
    diode: ["A", "K"],
    bjt: ["C", "B", "E", "S"],
    switch: ["1", "2", "CTRL+", "CTRL-"],
    mosfet: ["D", "G", "S", "B"],
  };
  const known = byFamily[statement.family] ?? [];
  return statement.nodes.map((_, index) => known[index] ?? `P${index + 1}`);
}

function targetFor(
  statement: InstanceStatement,
  definitions: Map<string, CellDefinition>,
): { target: CircuitTarget; pinNames: string[]; calledCell?: string } {
  if (statement.family === "subcircuit") {
    const master = statement.master!;
    const definition = definitions.get(normalizeName(master));
    if (definition) {
      return {
        target: { kind: "subcircuit", cellName: definition.name },
        pinNames: statement.nodes.map(
          (_, index) => definition.ports[index] ?? `P${index + 1}`,
        ),
        calledCell: definition.name,
      };
    }
    return {
      target: { kind: "opaque", sourceName: master },
      pinNames: statement.nodes.map((_, index) => `P${index + 1}`),
    };
  }
  if (
    ["diode", "bjt", "switch", "mosfet"].includes(statement.family) &&
    statement.master
  ) {
    return {
      target: { kind: "model", modelName: statement.master },
      pinNames: defaultPinNames(statement),
    };
  }
  return {
    target: { kind: "primitive", family: statement.family },
    pinNames: defaultPinNames(statement),
  };
}

function buildCell(
  definition: CellDefinition,
  definitions: Map<string, CellDefinition>,
  globalNames: Set<string>,
  diagnostics: SpiceDiagnostic[],
  calledCells: Set<string>,
): CircuitCellIR {
  const netByName = new Map<string, CircuitNetIR>();
  const netFor = (name: string): CircuitNetIR => {
    const normalized = normalizeName(name);
    let net = netByName.get(normalized);
    if (!net) {
      net = {
        id: deriveStableId("net", normalizeName(definition.name), normalized),
        name,
        scope: globalNames.has(normalized) ? "global" : "local",
      };
      netByName.set(normalized, net);
    }
    return net;
  };

  const ports = definition.ports.map((name, position) => ({
    name,
    position,
    netId: netFor(name).id,
    sourceRef: definition.sourceRef,
  }));
  const instances: CircuitInstanceIR[] = [];
  const seenInstances = new Map<string, number>();
  for (const statement of definition.instances) {
    const normalizedInstance = normalizeName(statement.name);
    const occurrence = (seenInstances.get(normalizedInstance) ?? 0) + 1;
    seenInstances.set(normalizedInstance, occurrence);
    if (occurrence > 1) {
      diagnostics.push(
        diagnostic(
          "SPICE_BIND_DUPLICATE_INSTANCE",
          "error",
          "bind",
          `Duplicate instance ${statement.name} in ${definition.name}`,
          statement.sourceRef,
        ),
      );
    }
    const resolved = targetFor(statement, definitions);
    if (resolved.calledCell)
      calledCells.add(normalizeName(resolved.calledCell));
    if (resolved.target.kind === "subcircuit") {
      const targetDefinition = definitions.get(
        normalizeName(resolved.target.cellName),
      )!;
      if (targetDefinition.ports.length !== statement.nodes.length) {
        diagnostics.push(
          diagnostic(
            "SPICE_BIND_TERMINAL_COUNT",
            "error",
            "bind",
            `${statement.name} has ${statement.nodes.length} terminals; ${targetDefinition.name} requires ${targetDefinition.ports.length}`,
            statement.sourceRef,
          ),
        );
      }
    }
    instances.push({
      id:
        occurrence === 1
          ? statement.name
          : deriveStableId(
              "instance",
              definition.name,
              statement.name,
              String(occurrence),
            ),
      name: statement.name,
      target: resolved.target,
      terminals: statement.nodes.map((name, position) => ({
        position,
        name: resolved.pinNames[position] ?? `P${position + 1}`,
        netId: netFor(name).id,
      })),
      parameters: parameterRecord(
        statement.parameters,
        statement.controlSource,
      ),
      sourceRef: statement.sourceRef,
    });
  }
  return {
    id: deriveStableId("cell", normalizeName(definition.name)),
    name: definition.name,
    ports,
    nets: [...netByName.values()],
    instances,
    parameters: definition.parameters.map(declaration),
    sourceRef: definition.sourceRef,
  };
}

export function compileSourceBundle(bundle: SourceBundle): SpiceCompileResult {
  const diagnostics = [...bundle.diagnostics];
  if (!bundle.entryFileId) {
    return { bundle, ir: null, diagnostics, successful: false };
  }
  const collected = collectDefinitions(bundle, diagnostics);
  const definitions = new Map<string, CellDefinition>();
  for (const definition of collected.definitions) {
    const key = normalizeName(definition.name);
    const previous = definitions.get(key);
    if (previous) {
      diagnostics.push(
        diagnostic(
          "SPICE_BIND_DUPLICATE_SUBCKT",
          "error",
          "bind",
          `Duplicate subcircuit definition: ${definition.name}`,
          definition.sourceRef,
          [{ message: "First definition", sourceRef: previous.sourceRef }],
        ),
      );
      continue;
    }
    definitions.set(key, definition);
  }
  const calledCells = new Set<string>();
  const cells = [...definitions.values()].map((definition) =>
    buildCell(
      definition,
      definitions,
      collected.globalNames,
      diagnostics,
      calledCells,
    ),
  );
  const topCells = cells
    .filter((cell) => !calledCells.has(normalizeName(cell.name)))
    .map((cell) => cell.name);
  if (cells.length > 0 && topCells.length === 0) {
    diagnostics.push(
      diagnostic(
        "SPICE_BIND_NO_ROOT",
        "error",
        "bind",
        "No non-recursive top-cell candidate exists",
      ),
    );
  }
  const candidate = CircuitIRSchema.safeParse({
    dialect: "spice-current-profile",
    topCells,
    cells,
    parameters: collected.parameters,
    models: collected.models,
    unresolvedStatements: collected.opaque,
  });
  if (!candidate.success) {
    diagnostics.push(
      diagnostic(
        "SPICE_BIND_INVALID_IR",
        "error",
        "bind",
        candidate.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      ),
    );
    return { bundle, ir: null, diagnostics, successful: false };
  }
  return {
    bundle,
    ir: candidate.data,
    diagnostics,
    successful: !diagnostics.some((item) => item.severity === "error"),
  };
}

export async function compileSpiceSources(
  inputs: readonly SpiceSourceInput[],
  entryPath: string,
): Promise<SpiceCompileResult> {
  return compileSourceBundle(await createSourceBundle(inputs, entryPath));
}
