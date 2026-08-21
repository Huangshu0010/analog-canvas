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

function schematicReferencePrefix(instance: Record<string, unknown>): string {
  switch (instance.symbolId) {
    case "resistor":
      return "R";
    case "capacitor":
      return "C";
    case "inductor":
      return "L";
    case "diode":
      return "D";
    case "nmos":
    case "pmos":
      return "M";
    case "npn":
    case "pnp":
      return "Q";
    case "voltage-source":
      return "V";
    case "current-source":
      return "I";
    case "port":
    case "port-filled":
      return "P";
    case "ground":
      return "GND";
    case "vdd-port":
      return "VDD";
    default: {
      const netlist = isRecord(instance.netlist) ? instance.netlist : null;
      const binding =
        netlist && isRecord(netlist.binding) ? netlist.binding : null;
      return binding?.kind === "subcircuit" ||
        binding?.kind === "external-subcircuit" ||
        binding?.kind === "unresolved-subcircuit"
        ? "X"
        : "X";
    }
  }
}

function nextSchematicReference(prefix: string, used: Set<string>): string {
  let suffix = 1;
  while (used.has(`${prefix}${suffix}`.toLowerCase())) suffix += 1;
  const reference = `${prefix}${suffix}`;
  used.add(reference.toLowerCase());
  return reference;
}

/**
 * The rolling migration adds an explicitly schematic-facing reference to
 * every Instance. Emitting instances preserve their netlist designator;
 * non-emitting objects receive a deterministic presentation reference.
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
    const usedSchematicReferences = new Set<string>();
    for (const rawInstance of instances) {
      if (!isRecord(rawInstance) || typeof rawInstance.id !== "string")
        continue;
      const netlist = isRecord(rawInstance.netlist)
        ? rawInstance.netlist
        : null;
      const emittedReference =
        netlist && typeof netlist.reference === "string"
          ? netlist.reference.trim()
          : "";
      const isPort =
        rawInstance.symbolId === "port" ||
        rawInstance.symbolId === "port-filled";
      rawInstance.schematicReference =
        emittedReference && !isPort
          ? emittedReference
          : nextSchematicReference(
              schematicReferencePrefix(rawInstance),
              usedSchematicReferences,
            );
      usedSchematicReferences.add(
        (rawInstance.schematicReference as string).toLowerCase(),
      );
    }
  }
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  return project;
}
