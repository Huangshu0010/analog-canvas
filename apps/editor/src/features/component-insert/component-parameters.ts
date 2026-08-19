import type { Instance } from "@icm/model";
import { deviceDescriptor } from "@icm/devices";

export interface ComponentParameter {
  key: string;
  label: string;
  unit?: string;
  placeholder: string;
  help: string;
  inputMode?: "decimal" | "text";
}

export function componentParameters(
  symbolId: string,
): readonly ComponentParameter[] {
  return (deviceDescriptor(symbolId)?.parameters ?? []).map((parameter) => ({
    key: parameter.name,
    label: parameter.label,
    ...(parameter.unitHint ? { unit: parameter.unitHint } : {}),
    placeholder: parameter.placeholder,
    help: parameter.help,
    inputMode: parameter.editor,
  }));
}

export function initialComponentParameterValues(
  symbolId: string,
): Record<string, string> {
  return Object.fromEntries(
    componentParameters(symbolId).map((parameter) => [parameter.key, ""]),
  );
}

export function effectiveComponentParameterValue(
  instance: Instance,
  parameter: ComponentParameter,
): string {
  const netlist = instance.netlist?.parameters[parameter.key];
  if (netlist !== undefined) return netlist;
  return "";
}
