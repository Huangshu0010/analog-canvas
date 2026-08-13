// ADR 0017 schema 3 -> 4 migration. Adds deterministic Cell interfaces and
// typed Instance netlist facts without inventing models, hierarchy, sources,
// connectivity, libraries, or simulation directives.

const TARGET_SCHEMA_VERSION = 4;

type Record_ = Record<string, unknown>;

const SYMBOL_DEVICE_CLASS: Readonly<Record<string, string>> = {
  resistor: "resistor",
  capacitor: "capacitor",
  inductor: "inductor",
  nmos: "mos",
  pmos: "mos",
  diode: "diode",
  npn: "bjt",
  pnp: "bjt",
  "voltage-source": "voltage-source",
  "current-source": "current-source",
  ground: "net-marker",
  vdd: "net-marker",
};

const REFERENCE_PREFIX: Readonly<Record<string, string>> = {
  resistor: "R",
  capacitor: "C",
  inductor: "L",
  mos: "M",
  diode: "D",
  bjt: "Q",
  "voltage-source": "V",
  "current-source": "I",
  "net-marker": "PWR",
};

const DIRECT_PARAMETER_NAMES: Readonly<Record<string, readonly string[]>> = {
  resistor: ["value"],
  capacitor: ["value"],
  inductor: ["value"],
  mos: ["w", "l", "m"],
};

function isRecord(value: unknown): value is Record_ {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 120);
  const candidate = normalized || fallback;
  return /^[A-Za-z_]/u.test(candidate) ? candidate : `_${candidate}`;
}

function uniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, Math.max(1, 124 - String(suffix).length))}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function deviceClassFor(instance: Record_): string | undefined {
  const symbolId = asString(instance.symbolId)?.toLowerCase();
  return symbolId ? SYMBOL_DEVICE_CLASS[symbolId] : undefined;
}

function typedBinding(instance: Record_, deviceClass: string | undefined) {
  const evidence = isRecord(instance.binding) ? instance.binding : undefined;
  const kind = asString(evidence?.kind);
  const name = asString(evidence?.name);
  if (kind === "subcircuit" && name) {
    const childDocumentId = asString(evidence?.childDocumentId);
    return childDocumentId
      ? { kind: "subcircuit", childDocumentId, name }
      : { kind: "external-subcircuit", name };
  }
  if ((kind === "model" || kind === "opaque") && name && deviceClass) {
    return { kind: "model", deviceClass, name };
  }
  if (kind === "primitive" && deviceClass) {
    return { kind: "primitive", deviceClass };
  }
  if (
    deviceClass &&
    ["resistor", "capacitor", "inductor", "net-marker"].includes(deviceClass)
  ) {
    return { kind: "primitive", deviceClass };
  }
  return undefined;
}

function parameterRecord(
  properties: Record_,
  deviceClass: string | undefined,
): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith("spice.param.")) continue;
    const name = key.slice("spice.param.".length);
    const rawValue =
      asString(value) ??
      (typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : undefined);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) && rawValue) {
      parameters[name] = rawValue;
    }
  }
  for (const name of DIRECT_PARAMETER_NAMES[deviceClass ?? ""] ?? []) {
    const value = properties[name];
    const rawValue =
      asString(value) ??
      (typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : undefined);
    if (rawValue) parameters[name] = rawValue;
  }
  return parameters;
}

function migrateInstances(instances: unknown[]): unknown[] {
  const usedReferences = new Set<string>();
  const nextByPrefix = new Map<string, number>();

  return instances.map((value) => {
    if (!isRecord(value)) return value;
    if (isRecord(value.netlist)) {
      const reference = asString(value.netlist.reference);
      if (reference) usedReferences.add(reference.toLowerCase());
      return value;
    }

    const deviceClass = deviceClassFor(value);
    const properties = isRecord(value.properties) ? value.properties : {};
    const importedReference = asString(properties["spice.name"]);
    const prefix = REFERENCE_PREFIX[deviceClass ?? ""] ?? "X";
    let reference = importedReference;
    if (!reference) {
      let next = nextByPrefix.get(prefix) ?? 1;
      do {
        reference = `${prefix}${next}`;
        next += 1;
      } while (usedReferences.has(reference.toLowerCase()));
      nextByPrefix.set(prefix, next);
    }
    if (usedReferences.has(reference.toLowerCase())) {
      let suffix = 2;
      const base = reference;
      do {
        reference = `${base}_${suffix}`;
        suffix += 1;
      } while (usedReferences.has(reference.toLowerCase()));
    }
    usedReferences.add(reference.toLowerCase());

    const binding = typedBinding(value, deviceClass);
    return {
      ...value,
      netlist: {
        reference,
        ...(binding ? { binding } : {}),
        parameters: parameterRecord(properties, deviceClass),
      },
    };
  });
}

export function migrateV3ToV4(input: Record_): Record_ {
  const usedCellNames = new Set<string>();
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const migratedDocuments = documents.map((value, index) => {
    if (!isRecord(value)) return value;
    const existingNetlist = isRecord(value.netlist) ? value.netlist : undefined;
    const sourceBinding = isRecord(value.sourceBinding)
      ? value.sourceBinding
      : undefined;
    const preferredName =
      asString(existingNetlist?.name) ??
      asString(sourceBinding?.cellName) ??
      asString(value.name) ??
      `Cell_${index + 1}`;
    const cellName = uniqueName(
      sanitizeIdentifier(preferredName, `Cell_${index + 1}`),
      usedCellNames,
    );
    const ports = Array.isArray(value.ports) ? value.ports : [];
    const portOrder = Array.isArray(existingNetlist?.portOrder)
      ? existingNetlist.portOrder
      : ports.flatMap((port) =>
          isRecord(port) && asString(port.id) ? [asString(port.id)!] : [],
        );
    return {
      ...value,
      netlist: { name: cellName, portOrder },
      instances: migrateInstances(
        Array.isArray(value.instances) ? value.instances : [],
      ),
    };
  });
  return {
    ...input,
    schemaVersion: TARGET_SCHEMA_VERSION,
    documents: migratedDocuments,
  };
}
