import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function terminalMapping(value: unknown): unknown[] {
  return Array.isArray(value) ? structuredClone(value) : [];
}

function parameterValues(
  properties: unknown,
  existing: Record<string, unknown>,
  path: readonly (string | number)[],
): Record<string, unknown> {
  if (!isRecord(properties)) return existing;
  const parameters = { ...existing };
  for (const [key, value] of Object.entries(properties)) {
    if (value === "" || value === undefined) continue;
    if (!["value", "w", "l", "m", "dc"].includes(key)) {
      throw new ProjectMigrationError(
        [...path, key],
        `Schema-14 legacy property ${key} has no schema-15 netlist authority`,
      );
    }
    const normalized = String(value);
    if (parameters[key] !== undefined && parameters[key] !== normalized) {
      throw new ProjectMigrationError(
        [...path, key],
        `Schema-14 legacy property ${key} conflicts with netlist.parameters.${key}`,
      );
    }
    parameters[key] = normalized;
  }
  return parameters;
}

/** The rolling migration: schema 14 gains stable external-terminal identities. */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  const definitions = new Map<
    string,
    {
      id: string;
      name: string;
      terminals: unknown[];
      formalParameters: unknown[];
    }
  >();
  const documents = Array.isArray(project.documents) ? project.documents : [];
  for (const [documentIndex, rawDocument] of documents.entries()) {
    if (!isRecord(rawDocument)) continue;
    const document = rawDocument;
    if (isRecord(document.netlist)) {
      document.netlist.formalParameters ??= [];
    }
    const instances = Array.isArray(document.instances)
      ? document.instances
      : [];
    for (const [instanceIndex, rawInstance] of instances.entries()) {
      if (!isRecord(rawInstance)) continue;
      const instance = rawInstance;
      const oldNetlist = isRecord(instance.netlist)
        ? instance.netlist
        : undefined;
      const oldProperties = instance.properties;
      const oldTerminals = terminalMapping(oldNetlist?.terminals);
      let provenance = isRecord(instance.importProvenance)
        ? { ...instance.importProvenance }
        : undefined;
      const provenanceAttributes = provenance?.attributes;
      if (provenance && isRecord(provenanceAttributes)) {
        const registryId = provenanceAttributes["symbol.mapping.registry"];
        if (typeof registryId === "string") {
          provenance.symbolMappingRegistryId = registryId;
        }
        delete provenance.attributes;
      }
      if (oldTerminals.length > 0) {
        const binding = oldNetlist?.binding;
        const bindingKind = isRecord(binding) ? binding.kind : undefined;
        const importedName =
          isRecord(binding) && typeof binding.name === "string"
            ? binding.name
            : typeof instance.id === "string"
              ? instance.id
              : `instance-${instanceIndex}`;
        provenance ??= {
          kind:
            bindingKind === "primitive" ||
            bindingKind === "model" ||
            bindingKind === "subcircuit"
              ? bindingKind
              : "opaque",
          name: importedName,
          sourceTarget: `schema-13:instance:${importedName}`,
        };
        provenance.terminalMapping = oldTerminals;
      }
      if (provenance) instance.importProvenance = provenance;
      if (oldNetlist) {
        const { terminals: _terminals, ...nextNetlist } = oldNetlist;
        nextNetlist.parameters = parameterValues(
          oldProperties,
          isRecord(nextNetlist.parameters) ? nextNetlist.parameters : {},
          [
            "documents",
            documentIndex,
            "instances",
            instanceIndex,
            "properties",
          ],
        );
        if (isRecord(nextNetlist.binding)) {
          const binding = nextNetlist.binding;
          if (binding.kind === "subcircuit") delete binding.name;
          if (binding.kind === "external-subcircuit") {
            const name = binding.name;
            if (typeof name !== "string") {
              throw new ProjectMigrationError(
                [
                  "documents",
                  documentIndex,
                  "instances",
                  instanceIndex,
                  "netlist",
                  "binding",
                ],
                "Schema-13 external subcircuit binding has no name",
              );
            }
            const key = name.toLowerCase();
            const terminals = oldTerminals;
            const existing = definitions.get(key);
            if (
              existing &&
              JSON.stringify(existing.terminals) !== JSON.stringify(terminals)
            ) {
              // The Project remains loadable, but this imported target cannot
              // honestly claim one resolved external interface. Preserve its
              // source name as an explicit analyzer-blocking unresolved state.
              nextNetlist.binding = {
                kind: "unresolved-subcircuit",
                name,
              };
              instance.netlist = nextNetlist;
              delete instance.properties;
              continue;
            }
            const definition = existing ?? {
              id: `external-subcircuit-${key.replaceAll(/[^a-z0-9_-]/gu, "-")}`,
              name,
              terminals: terminals.map((terminal) => ({
                name: isRecord(terminal) ? terminal.pinName : "",
              })),
              formalParameters: [],
            };
            definitions.set(key, definition);
            nextNetlist.binding = {
              kind: "external-subcircuit",
              definitionId: definition.id,
            };
          }
        }
        instance.netlist = nextNetlist;
      } else if (oldProperties !== undefined) {
        const parameters = parameterValues(oldProperties, {}, [
          "documents",
          documentIndex,
          "instances",
          instanceIndex,
          "properties",
        ]);
        if (Object.keys(parameters).length > 0) {
          if (typeof instance.id !== "string" || instance.id.length === 0) {
            throw new ProjectMigrationError(
              ["documents", documentIndex, "instances", instanceIndex, "id"],
              "Schema-13 legacy properties require a stable instance ID for reference migration",
            );
          }
          instance.netlist = { reference: instance.id, parameters };
        }
      }
      delete instance.properties;
    }
  }
  const existingDefinitions = Array.isArray(
    project.externalSubcircuitDefinitions,
  )
    ? project.externalSubcircuitDefinitions
    : [...definitions.values()];
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  project.externalSubcircuitDefinitions = existingDefinitions.map(
    (rawDefinition, definitionIndex) => {
      if (!isRecord(rawDefinition)) return rawDefinition;
      const definitionId =
        typeof rawDefinition.id === "string"
          ? rawDefinition.id
          : `external-subcircuit-${definitionIndex + 1}`;
      const terminals = Array.isArray(rawDefinition.terminals)
        ? rawDefinition.terminals
        : [];
      return {
        ...rawDefinition,
        id: definitionId,
        terminals: terminals.map((rawTerminal, terminalIndex) => {
          const terminal = isRecord(rawTerminal) ? rawTerminal : {};
          return {
            ...terminal,
            id:
              typeof terminal.id === "string"
                ? terminal.id
                : `external-terminal-${definitionId}-${terminalIndex + 1}`,
            direction:
              terminal.direction === "input" ||
              terminal.direction === "output" ||
              terminal.direction === "inout" ||
              terminal.direction === "passive"
                ? terminal.direction
                : "passive",
          };
        }),
        interfaceStatus:
          rawDefinition.interfaceStatus === "inferred-positional"
            ? "inferred-positional"
            : "declared",
      };
    },
  );
  return project;
}
