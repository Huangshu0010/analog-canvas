import type {
  InstanceNetlistBinding,
  InstanceNetlistData,
  SchematicDocument,
} from "@icm/model";
import {
  createReferenceIndex,
  deviceDescriptor,
  nextReference,
  referencePolicyForSymbol,
} from "@icm/devices";

function referencePrefix(symbolId: string): string {
  const policy = referencePolicyForSymbol(symbolId);
  return policy.kind === "required" ? policy.prefix : "X";
}

/**
 * Prefixes used for on-canvas placement labels. Schematic-only markers keep
 * their label prefixes here; real devices inherit the reviewed netlist
 * reference prefix so a placed label and its netlist reference agree.
 */
const placementPrefixOverrides: Record<string, string> = {
  ground: "GND",
  port: "P",
  "port-filled": "P",
  "vdd-port": "VDD",
};

export function placementReferencePrefix(symbolId: string): string {
  return placementPrefixOverrides[symbolId] ?? referencePrefix(symbolId);
}

/**
 * Lowest unused per-prefix designator across the union of instance ids and
 * netlist references, so the visible label, the instance id, and the netlist
 * reference never collide with either domain (undo, reload, and deletion all
 * re-scan the live document, and freed numbers are reused).
 */
export function nextInstanceDesignator(
  document: SchematicDocument,
  symbolId: string,
): string {
  const prefix = placementReferencePrefix(symbolId);
  const used = new Set<string>();
  for (const instance of document.instances) {
    used.add(instance.id.toLowerCase());
    if (instance.netlist?.reference) {
      used.add(instance.netlist.reference.toLowerCase());
    }
  }
  let index = 1;
  while (used.has(`${prefix}${index}`.toLowerCase())) index += 1;
  return `${prefix}${index}`;
}

/**
 * Whether the placement label prefix equals the netlist reference prefix, so
 * one designator can serve as both the instance id and its netlist reference.
 */
export function netlistReferenceMatchesPlacement(symbolId: string): boolean {
  const netlistPrefix = deviceDescriptor(symbolId)?.referencePrefix;
  if (!netlistPrefix) return false;
  return (
    netlistPrefix.toLowerCase() ===
    placementReferencePrefix(symbolId).toLowerCase()
  );
}

export function nextInstanceReference(
  document: SchematicDocument,
  symbolId: string,
): string {
  return (
    nextReference(
      createReferenceIndex(document),
      referencePolicyForSymbol(symbolId),
    ) ?? ""
  );
}

function rawParameters(
  parameterValues: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parameterValues)
      .filter(
        ([name, value]) =>
          /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) && typeof value === "string",
      )
      .map(([name, value]) => [name, String(value)])
      .filter(([, value]) => value !== ""),
  );
}

function defaultBinding(symbolId: string): InstanceNetlistBinding | undefined {
  const definition = deviceDescriptor(symbolId);
  if (!definition || definition.targetPolicy === "required-model") {
    return undefined;
  }
  if (definition.targetPolicy === "builtin") {
    return {
      kind: "primitive",
      deviceClass: definition.deviceClass,
    };
  }
  return undefined;
}

export function initialInstanceNetlist(
  document: SchematicDocument,
  symbolId: string,
  parameterValues: Readonly<Record<string, string>>,
  reference?: string,
): InstanceNetlistData | undefined {
  const policy = referencePolicyForSymbol(symbolId);
  if (policy.kind === "none") return undefined;
  const binding = defaultBinding(symbolId);
  return {
    reference:
      reference ?? nextReference(createReferenceIndex(document), policy)!,
    ...(binding ? { binding } : {}),
    parameters: rawParameters(parameterValues),
  };
}

export function bindingForEditedModel(
  symbolId: string,
  modelName: string,
): InstanceNetlistBinding | undefined {
  const definition = deviceDescriptor(symbolId);
  if (!definition) return undefined;
  if (definition.targetPolicy === "required-model") {
    return modelName.trim()
      ? {
          kind: "model",
          deviceClass: definition.deviceClass,
          name: modelName.trim(),
        }
      : undefined;
  }
  return defaultBinding(symbolId);
}
