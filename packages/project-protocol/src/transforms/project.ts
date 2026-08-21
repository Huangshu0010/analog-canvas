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
 * Schema 20 lets one formal CellTerminal own multiple ordinary Port marker
 * Instances. The rolling schema-19 reader preserves every existing marker by
 * lifting its singular identity into a one-element array; topology is
 * otherwise unchanged.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const project = structuredClone(raw);
  const documents = Array.isArray(project.documents) ? project.documents : [];
  for (const [documentIndex, rawDocument] of documents.entries()) {
    if (!isRecord(rawDocument)) continue;
    const netlist = isRecord(rawDocument.netlist) ? rawDocument.netlist : null;
    const terminals =
      netlist && Array.isArray(netlist.terminals) ? netlist.terminals : [];
    for (const [terminalIndex, terminal] of terminals.entries()) {
      if (!isRecord(terminal)) continue;
      if (typeof terminal.interfaceInstanceId !== "string") {
        throw new ProjectMigrationError(
          [
            "documents",
            documentIndex,
            "netlist",
            "terminals",
            terminalIndex,
            "interfaceInstanceId",
          ],
          "Schema-19 Cell terminal requires interfaceInstanceId",
        );
      }
      terminal.interfaceInstanceIds = [terminal.interfaceInstanceId];
      delete terminal.interfaceInstanceId;
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
