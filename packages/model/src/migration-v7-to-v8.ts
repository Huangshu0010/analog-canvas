// Schema 7 -> 8 migration. Typed netlist facts and bounded import provenance
// replace the mutable `spice.*` compatibility property family. This migration
// consumes only explicit source facts; it never discovers a child Cell by name
// or invents source terminal order.

const TARGET_SCHEMA_VERSION = 8;

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPrimitive(value: unknown): string | number | boolean | undefined {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : undefined;
}

function legacyTerminalMap(properties: Record_): Record_[] | undefined {
  const terminals = Object.entries(properties)
    .flatMap(([key, value]) => {
      const match = /^spice\.pin\.P([1-9][0-9]*)$/u.exec(key);
      const pinName = asString(value);
      return match && pinName
        ? [{ sourcePosition: Number(match[1]) - 1, pinName }]
        : [];
    })
    .sort((left, right) => left.sourcePosition - right.sourcePosition);
  if (terminals.length === 0) return undefined;
  const seen = new Set<number>();
  if (
    terminals.some((terminal) => {
      if (seen.has(terminal.sourcePosition)) return true;
      seen.add(terminal.sourcePosition);
      return false;
    })
  ) {
    // Object keys cannot normally duplicate, but fail closed if an unusual
    // decoded record has already normalized conflicting source positions.
    return undefined;
  }
  return terminals;
}

function importProvenance(
  instance: Record_,
  properties: Record_,
): Record_ | undefined {
  const legacy = isRecord(instance.binding) ? instance.binding : undefined;
  const kind = asString(legacy?.kind);
  const name = asString(legacy?.name);
  const status = asString(legacy?.status);
  const sourceTarget =
    asString(properties["spice.target"]) ??
    (kind && name ? `${kind}:${name}` : undefined);
  const parsedTarget = /^((?:primitive|model|subcircuit|opaque)):(.+)$/u.exec(
    sourceTarget ?? "",
  );
  const migratedKind = kind ?? parsedTarget?.[1];
  const migratedName = name ?? asString(parsedTarget?.[2]);
  if (
    !migratedKind ||
    !migratedName ||
    !sourceTarget ||
    !["primitive", "model", "subcircuit", "opaque"].includes(migratedKind) ||
    (status !== undefined &&
      !["resolved", "missing", "unsupported"].includes(status))
  ) {
    return undefined;
  }
  const attributes = Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => key.startsWith("spice."))
      .filter(
        ([key]) =>
          key !== "spice.name" &&
          key !== "spice.target" &&
          key !== "spice.childDocumentId" &&
          !key.startsWith("spice.param.") &&
          !key.startsWith("spice.pin."),
      )
      .flatMap(([key, value]) => {
        const primitive = asPrimitive(value);
        return primitive === undefined
          ? []
          : [[`legacy.${key.slice("spice.".length)}`, primitive] as const];
      }),
  );
  return {
    kind: migratedKind,
    name: migratedName,
    sourceTarget,
    ...(status ? { status } : {}),
    ...(asString(legacy?.modelType)
      ? { modelType: asString(legacy?.modelType)! }
      : {}),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

function migrateInstance(
  instance: Record_,
  documentIds: ReadonlySet<string>,
): Record_ {
  const { binding: _legacyBinding, ...currentInstance } = instance;
  const properties = isRecord(instance.properties) ? instance.properties : {};
  const legacyChildDocumentId = asString(properties["spice.childDocumentId"]);
  const oldNetlist = isRecord(instance.netlist) ? instance.netlist : undefined;
  const netlist: Record_ | undefined = oldNetlist
    ? {
        ...oldNetlist,
        ...(oldNetlist.terminals === undefined
          ? (() => {
              const terminals = legacyTerminalMap(properties);
              return terminals ? { terminals } : {};
            })()
          : {}),
      }
    : undefined;
  const binding =
    netlist && isRecord(netlist.binding) ? netlist.binding : undefined;
  const migratedBinding =
    binding?.kind === "external-subcircuit" &&
    legacyChildDocumentId &&
    documentIds.has(legacyChildDocumentId)
      ? {
          kind: "subcircuit",
          name: binding.name,
          childDocumentId: legacyChildDocumentId,
        }
      : binding;
  const migratedNetlist = netlist
    ? {
        ...netlist,
        ...(migratedBinding ? { binding: migratedBinding } : {}),
      }
    : undefined;
  const ordinaryProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !key.startsWith("spice.")),
  );
  const provenance = importProvenance(instance, properties);
  return {
    ...currentInstance,
    ...(migratedNetlist ? { netlist: migratedNetlist } : {}),
    properties: ordinaryProperties,
    ...(provenance ? { importProvenance: provenance } : {}),
    // Schema-v8 removes the old duplicated source-binding evidence. The status
    // and source target now live in immutable provenance, while electrical
    // binding lives under `netlist`.
  };
}

function migrateDocument(
  document: Record_,
  documentIds: ReadonlySet<string>,
): Record_ {
  const instances = Array.isArray(document.instances)
    ? document.instances.map((instance) =>
        isRecord(instance) ? migrateInstance(instance, documentIds) : instance,
      )
    : document.instances;
  return { ...document, instances };
}

/** Consumes legacy runtime SPICE properties exactly once on Project read. */
export function migrateV7ToV8(input: Record_): Record_ {
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const documentIds = new Set(
    documents.flatMap((document) =>
      isRecord(document) && typeof document.id === "string"
        ? [document.id]
        : [],
    ),
  );
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: documents.map((document) =>
      isRecord(document) ? migrateDocument(document, documentIds) : document,
    ),
  };
}
