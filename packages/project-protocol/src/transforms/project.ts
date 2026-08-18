import { CURRENT_PROJECT_SCHEMA_VERSION, deriveStableId } from "@icm/model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueDerivedId(
  used: Set<string>,
  prefix: string,
  identity: readonly string[],
): string {
  let salt = 0;
  while (true) {
    const id = deriveStableId(prefix, ...identity, String(salt));
    if (!used.has(id.toLowerCase())) {
      used.add(id.toLowerCase());
      return id;
    }
    salt += 1;
  }
}

function migrateDocument(rawDocument: unknown): unknown {
  if (!isRecord(rawDocument)) return rawDocument;
  const document = structuredClone(rawDocument);
  if (!Array.isArray(document.instances) || !Array.isArray(document.nets)) {
    return document;
  }
  const instances = document.instances;
  const nets = document.nets;
  const netlist = document.netlist;
  if (!isRecord(netlist) || !Array.isArray(netlist.terminals)) return document;

  const documentId =
    typeof document.id === "string" ? document.id : "unknown-document";
  const usedIds = new Set<string>();
  for (const collectionName of [
    "instances",
    "nets",
    "routes",
    "junctions",
    "noConnects",
    "annotations",
    "layoutGroups",
    "constraints",
  ]) {
    const collection = document[collectionName];
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      if (isRecord(item) && typeof item.id === "string") {
        usedIds.add(item.id.toLowerCase());
      }
    }
  }
  const drafting = document.drafting;
  if (isRecord(drafting) && Array.isArray(drafting.objects)) {
    for (const item of drafting.objects) {
      if (isRecord(item) && typeof item.id === "string") {
        usedIds.add(item.id.toLowerCase());
      }
    }
  }

  netlist.terminals = netlist.terminals.map((rawTerminal, index) => {
    if (!isRecord(rawTerminal)) return rawTerminal;
    const terminal = structuredClone(rawTerminal);
    const terminalName =
      typeof terminal.name === "string" ? terminal.name : String(index);
    const terminalId = uniqueDerivedId(usedIds, "cell-terminal", [
      documentId,
      String(index),
      terminalName,
    ]);
    const interfaceInstanceId = uniqueDerivedId(usedIds, "cell-port", [
      documentId,
      String(index),
      terminalName,
    ]);
    instances.push({
      id: interfaceInstanceId,
      symbolId: "port",
      placement: null,
      properties: {},
    });
    if (typeof terminal.netId === "string") {
      const net = nets.find(
        (candidate) => isRecord(candidate) && candidate.id === terminal.netId,
      );
      if (isRecord(net) && Array.isArray(net.terminals)) {
        net.terminals.push({ instanceId: interfaceInstanceId, pinName: "P" });
      }
    }
    return {
      ...terminal,
      id: terminalId,
      direction: "passive",
      interfaceInstanceId,
    };
  });
  return document;
}

/**
 * The only active migration. Schema 12 makes each existing private formal
 * terminal a stable, ordinary Port-Instance-backed Cell interface object.
 */
export function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...raw,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    structureRevision: 0,
    documents: Array.isArray(raw.documents)
      ? raw.documents.map(migrateDocument)
      : raw.documents,
  };
}
