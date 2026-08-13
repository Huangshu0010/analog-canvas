// Schema 4 -> 5 migration. Electrical power intent moves from hidden legacy
// VDD/ground marker terminals into the persisted Net record. The inference is
// performed exactly once during migration; runtime consumers read only
// `net.powerDomain` thereafter.

const TARGET_SCHEMA_VERSION = 5;

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function legacyDomainForNet(
  net: Record_,
  instancesById: ReadonlyMap<string, Record_>,
): "none" | "vdd" | "ground" | "conflict" {
  const existing = net.powerDomain;
  if (
    existing === "none" ||
    existing === "vdd" ||
    existing === "ground" ||
    existing === "conflict"
  ) {
    return existing;
  }
  const domains = new Set<string>();
  const terminals = Array.isArray(net.terminals) ? net.terminals : [];
  for (const terminal of terminals) {
    if (!isRecord(terminal)) continue;
    const instanceId = terminal.instanceId;
    const pinName = terminal.pinName;
    if (typeof instanceId !== "string" || typeof pinName !== "string") continue;
    const symbolId = instancesById.get(instanceId)?.symbolId;
    if (symbolId === "vdd" && pinName === "P") domains.add("vdd");
    if (symbolId === "ground" && pinName === "0") domains.add("ground");
  }
  if (domains.size === 0) return "none";
  if (domains.size === 1) return [...domains][0]! as "vdd" | "ground";
  return "conflict";
}

/** Idempotently adds explicit power identity to every persisted Net. */
export function migrateV4ToV5(input: Record_): Record_ {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: documents.map((document) => {
      if (!isRecord(document)) return document;
      const instances = Array.isArray(document.instances)
        ? document.instances.filter(isRecord)
        : [];
      const instancesById = new Map(
        instances.flatMap((instance) =>
          typeof instance.id === "string"
            ? [[instance.id, instance] as const]
            : [],
        ),
      );
      const nets = Array.isArray(document.nets) ? document.nets : [];
      return {
        ...document,
        nets: nets.map((net) =>
          isRecord(net)
            ? { ...net, powerDomain: legacyDomainForNet(net, instancesById) }
            : net,
        ),
      };
    }),
  };
}
