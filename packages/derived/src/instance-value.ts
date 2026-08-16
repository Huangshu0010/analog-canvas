import type { Instance, RichTextDocument } from "@icm/model";
import { deviceNetlistDefinition } from "@icm/symbols";

export type InstanceValueDisplay =
  | { readonly kind: "displayable"; readonly content: RichTextDocument }
  | { readonly kind: "undisplayable"; readonly reason: string };

function effectiveParameterValue(instance: Instance, key: string): string {
  const netlist = instance.netlist?.parameters[key];
  if (netlist !== undefined) return netlist.trim();
  const explicit = instance.properties[key];
  if (typeof explicit === "string") return explicit.trim();
  if (typeof explicit === "number") return String(explicit);
  return "";
}

function textDocument(value: string): RichTextDocument {
  return { runs: [{ kind: "text", value }] };
}

/**
 * One pure authority for the optional Value annotation beside an instance.
 * Electrical truth stays in the typed netlist parameters (with the legacy
 * `properties` fallback); this only projects it to display text and never
 * writes back.
 */
export function displayableInstanceValue(
  instance: Instance,
): InstanceValueDisplay {
  const definition = deviceNetlistDefinition(instance.symbolId);
  if (!definition) {
    return {
      kind: "undisplayable",
      reason: `Symbol ${instance.symbolId} has no netlist device class`,
    };
  }
  switch (definition.deviceClass) {
    case "mos": {
      const width = effectiveParameterValue(instance, "w");
      const length = effectiveParameterValue(instance, "l");
      if (!width || !length) {
        return {
          kind: "undisplayable",
          reason: "MOS value needs both W and L",
        };
      }
      return {
        kind: "displayable",
        content: textDocument(`${width}/${length}`),
      };
    }
    case "resistor":
    case "capacitor":
    case "inductor":
    case "voltage-source":
    case "current-source": {
      const value = effectiveParameterValue(instance, "value");
      const dc = effectiveParameterValue(instance, "dc");
      // Passives carry `value`; independent sources carry `dc` (the netlist
      // contract key). A source never has both.
      const display = value || dc;
      if (!display) {
        return {
          kind: "undisplayable",
          reason: `${definition.deviceClass} value parameter is empty`,
        };
      }
      return { kind: "displayable", content: textDocument(display) };
    }
    default:
      return {
        kind: "undisplayable",
        reason: `${definition.deviceClass} has no defined value display`,
      };
  }
}
