import type { RichTextDocument } from "@icm/model";
import { deviceNetlistDefinition } from "@icm/symbols";

export type InstanceValueDisplay =
  | { readonly kind: "displayable"; readonly content: RichTextDocument }
  | { readonly kind: "undisplayable"; readonly reason: string };

/**
 * Structural input: a full Instance satisfies it, and callers can project a
 * not-yet-committed parameter draft without inventing netlist fields the
 * formatter never reads.
 */
export interface InstanceValueSource {
  readonly symbolId: string;
  readonly netlist?:
    { readonly parameters: Record<string, string> } | undefined;
  readonly properties: Record<string, string | number | boolean>;
}

/** Display unit per device class, appended to the raw parameter string. */
const VALUE_UNIT_BY_DEVICE_CLASS: Partial<Record<string, string>> = {
  mos: "m",
  resistor: "Ω",
  capacitor: "F",
  inductor: "H",
  "voltage-source": "V",
  "current-source": "A",
};

function effectiveParameterValue(
  instance: InstanceValueSource,
  key: string,
): string {
  const netlist = instance.netlist?.parameters[key];
  if (netlist !== undefined) return netlist.trim();
  const explicit = instance.properties[key];
  if (typeof explicit === "string") return explicit.trim();
  if (typeof explicit === "number") return String(explicit);
  return "";
}

function withUnit(raw: string, unit: string): string {
  // Values are typed as bare SPICE numbers; append the physical unit unless
  // the author already ended with it.
  return raw.endsWith(unit) ? raw : `${raw}${unit}`;
}

function boldText(value: string): RichTextDocument["runs"][number] {
  return {
    kind: "span",
    style: "bold",
    children: [{ kind: "text", value }],
  };
}

function boldDocument(value: string): RichTextDocument {
  return { runs: [boldText(value)] };
}

/**
 * One pure authority for the optional Value annotation beside an instance.
 * Electrical truth stays in the typed netlist parameters (with the legacy
 * `properties` fallback); this only projects it to display text and never
 * writes back. Display is Razavi textbook style: upright bold text with the
 * engineering unit, and a stacked fraction bar for MOS W/L.
 */
export function displayableInstanceValue(
  instance: InstanceValueSource,
): InstanceValueDisplay {
  const definition = deviceNetlistDefinition(instance.symbolId);
  if (!definition) {
    return {
      kind: "undisplayable",
      reason: `Symbol ${instance.symbolId} has no netlist device class`,
    };
  }
  const unit = VALUE_UNIT_BY_DEVICE_CLASS[definition.deviceClass];
  switch (definition.deviceClass) {
    case "mos": {
      const width = effectiveParameterValue(instance, "w");
      const length = effectiveParameterValue(instance, "l");
      if (!width || !length || !unit) {
        return {
          kind: "undisplayable",
          reason: "MOS value needs both W and L",
        };
      }
      return {
        kind: "displayable",
        content: {
          runs: [
            {
              kind: "fraction",
              numerator: boldDocument(withUnit(width, unit)),
              denominator: boldDocument(withUnit(length, unit)),
            },
          ],
        },
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
      if (!display || !unit) {
        return {
          kind: "undisplayable",
          reason: `${definition.deviceClass} value parameter is empty`,
        };
      }
      return {
        kind: "displayable",
        content: boldDocument(withUnit(display, unit)),
      };
    }
    default:
      return {
        kind: "undisplayable",
        reason: `${definition.deviceClass} has no defined value display`,
      };
  }
}
