import type { Instance } from "@icm/model";

export interface ComponentParameter {
  key: string;
  label: string;
  unit?: string;
  placeholder: string;
  help: string;
  inputMode?: "decimal" | "text";
}

const passiveValue = (unit: string, help: string, placeholder: string) =>
  [
    {
      key: "value",
      label: "Value",
      unit,
      placeholder,
      help,
      inputMode: "text" as const,
    },
  ] satisfies readonly ComponentParameter[];

const MOS_PARAMETERS = [
  {
    key: "w",
    label: "W",
    unit: "m",
    placeholder: "1u",
    help: "Channel width",
    inputMode: "text" as const,
  },
  {
    key: "l",
    label: "L",
    unit: "m",
    placeholder: "150n",
    help: "Channel length",
    inputMode: "text" as const,
  },
  {
    key: "m",
    label: "M",
    placeholder: "1",
    help: "Parallel multiplier",
    inputMode: "decimal" as const,
  },
] satisfies readonly ComponentParameter[];

const PARAMETERS_BY_SYMBOL: Readonly<
  Record<string, readonly ComponentParameter[]>
> = {
  resistor: passiveValue("Ohm", "Resistance", "10k"),
  capacitor: passiveValue("F", "Capacitance", "2p"),
  inductor: passiveValue("H", "Inductance", "3n"),
  nmos: MOS_PARAMETERS,
  pmos: MOS_PARAMETERS,
};

export function componentParameters(
  symbolId: string,
): readonly ComponentParameter[] {
  return PARAMETERS_BY_SYMBOL[symbolId] ?? [];
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
  const explicit = instance.properties[parameter.key];
  if (typeof explicit === "string" || typeof explicit === "number") {
    return String(explicit);
  }
  return "";
}
