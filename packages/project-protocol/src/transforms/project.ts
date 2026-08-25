import { CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";

export class ProjectMigrationError extends Error {
  constructor(
    readonly path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
  }
}

/**
 * Schema 24 gives every Port drawing one unambiguous Cell-interface meaning.
 * Non-repeated schema-23 Cell Pins migrate structurally. Retired free Port
 * objects are rejected instead of preserving a second interface meaning.
 */
export function upgradeSchema23To24(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  if (!Array.isArray(project.documents)) {
    project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
    return project;
  }
  for (const [documentIndex, rawDocument] of project.documents.entries()) {
    if (!isRecord(rawDocument)) continue;
    const netlist = isRecord(rawDocument.netlist) ? rawDocument.netlist : null;
    const terminals =
      netlist && Array.isArray(netlist.terminals)
        ? netlist.terminals.filter(isRecord)
        : [];
    const formalMarkerIds = new Set<string>();
    for (const [terminalIndex, terminal] of terminals.entries()) {
      const markerIds = Array.isArray(terminal.interfaceInstanceIds)
        ? terminal.interfaceInstanceIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      if (markerIds.length !== 1) {
        throw new ProjectMigrationError(
          [
            "documents",
            documentIndex,
            "netlist",
            "terminals",
            terminalIndex,
            "interfaceInstanceIds",
          ],
          "Schema 24 requires exactly one drawing marker per Cell Pin",
        );
      }
      terminal.interfaceInstanceId = markerIds[0];
      delete terminal.interfaceInstanceIds;
      formalMarkerIds.add(markerIds[0]!);
    }

    const instances = Array.isArray(rawDocument.instances)
      ? rawDocument.instances.filter(isRecord)
      : [];
    const orphanPort = instances.find(
      (instance) =>
        (instance.symbolId === "port" || instance.symbolId === "port-filled") &&
        typeof instance.id === "string" &&
        !formalMarkerIds.has(instance.id),
    );
    if (orphanPort) {
      throw new ProjectMigrationError(
        ["documents", documentIndex, "instances"],
        `Port ${String(orphanPort.id)} has no Cell terminal`,
      );
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
