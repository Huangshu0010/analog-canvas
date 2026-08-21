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

/**
 * The rolling migration makes RichText schematic labels the default instance
 * projection. Formal Cell Ports instead project only their terminal name.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  const documents = Array.isArray(project.documents) ? project.documents : [];
  for (const rawDocument of documents) {
    if (!isRecord(rawDocument)) continue;
    const instances = Array.isArray(rawDocument.instances)
      ? rawDocument.instances
      : [];
    const netlist = isRecord(rawDocument.netlist) ? rawDocument.netlist : null;
    const terminals =
      netlist && Array.isArray(netlist.terminals) ? netlist.terminals : [];
    const terminalIdByFormalPortInstance = new Map(
      terminals.flatMap((terminal) =>
        isRecord(terminal) &&
        typeof terminal.interfaceInstanceId === "string" &&
        typeof terminal.id === "string"
          ? [[terminal.interfaceInstanceId, terminal.id] as const]
          : [],
      ),
    );
    for (const rawInstance of instances) {
      if (!isRecord(rawInstance) || typeof rawInstance.id !== "string")
        continue;
      if (terminalIdByFormalPortInstance.has(rawInstance.id)) {
        delete rawInstance.schematicReference;
      }
    }
    const annotations = Array.isArray(rawDocument.annotations)
      ? rawDocument.annotations
      : [];
    const terminalIdsWithDesignator = new Set(
      annotations.flatMap((annotation) => {
        const binding =
          isRecord(annotation) && isRecord(annotation.binding)
            ? annotation.binding
            : null;
        return binding?.kind === "instance-designator" &&
          typeof binding.instanceId === "string" &&
          terminalIdByFormalPortInstance.has(binding.instanceId)
          ? [terminalIdByFormalPortInstance.get(binding.instanceId)!]
          : [];
      }),
    );
    const convertedTerminalIds = new Set<string>();
    rawDocument.annotations = annotations.flatMap((annotation) => {
      if (!isRecord(annotation) || !isRecord(annotation.binding)) {
        return [annotation];
      }
      const binding = annotation.binding;
      if (
        binding.kind === "instance-designator" &&
        typeof binding.instanceId === "string"
      ) {
        const terminalId = terminalIdByFormalPortInstance.get(
          binding.instanceId,
        );
        if (!terminalId) {
          return [
            {
              ...annotation,
              binding: {
                kind: "instance-schematic-name",
                instanceId: binding.instanceId,
              },
            },
          ];
        }
        if (convertedTerminalIds.has(terminalId)) return [];
        convertedTerminalIds.add(terminalId);
        return [
          {
            ...annotation,
            binding: { kind: "cell-terminal-name", terminalId },
          },
        ];
      }
      if (
        binding.kind === "cell-terminal-name" &&
        typeof binding.terminalId === "string" &&
        terminalIdsWithDesignator.has(binding.terminalId)
      ) {
        return [];
      }
      return [annotation];
    });
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
