import type {
  Instance,
  InstanceNetlistBinding,
  InstanceNetlistData,
  SchematicDocument,
} from "@icm/model";
import { deviceNetlistDefinition } from "@icm/symbols";

function referencePrefix(symbolId: string): string {
  return deviceNetlistDefinition(symbolId)?.referencePrefix ?? "X";
}

export function nextInstanceReference(
  document: SchematicDocument,
  symbolId: string,
): string {
  const prefix = referencePrefix(symbolId) || "PWR";
  const used = new Set(
    document.instances.flatMap((instance) =>
      instance.netlist?.reference
        ? [instance.netlist.reference.toLowerCase()]
        : [],
    ),
  );
  let index = 1;
  while (used.has(`${prefix}${index}`.toLowerCase())) index += 1;
  return `${prefix}${index}`;
}

function rawParameters(
  properties: Readonly<Instance["properties"]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(
        ([name, value]) =>
          /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) &&
          (typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"),
      )
      .map(([name, value]) => [name, String(value)])
      .filter(([, value]) => value !== ""),
  );
}

function defaultBinding(symbolId: string): InstanceNetlistBinding | undefined {
  const definition = deviceNetlistDefinition(symbolId);
  if (!definition || definition.targetPolicy === "required-model") {
    return undefined;
  }
  if (
    definition.targetPolicy === "builtin" ||
    definition.targetPolicy === "none"
  ) {
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
  properties: Readonly<Instance["properties"]>,
): InstanceNetlistData {
  const binding = defaultBinding(symbolId);
  return {
    reference: nextInstanceReference(document, symbolId),
    ...(binding ? { binding } : {}),
    parameters: rawParameters(properties),
  };
}

export function bindingForEditedModel(
  symbolId: string,
  modelName: string,
): InstanceNetlistBinding | undefined {
  const definition = deviceNetlistDefinition(symbolId);
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
