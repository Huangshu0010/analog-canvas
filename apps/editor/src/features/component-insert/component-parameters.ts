import type { Instance } from "@icm/model";

export interface ComponentParameter {
  key: string;
  label: string;
  sourceKey?: string;
  placeholder: string;
  help: string;
  inputMode?: "decimal" | "text";
}

const passiveValue = (label: string, help: string, placeholder: string) =>
  [
    {
      key: "value",
      label,
      sourceKey: "spice.param.value",
      placeholder,
      help,
      inputMode: "text" as const,
    },
  ] satisfies readonly ComponentParameter[];

const MOS_PARAMETERS = [
  {
    key: "w",
    label: "W",
    sourceKey: "spice.param.w",
    placeholder: "1u",
    help: "Channel width (m)",
    inputMode: "text" as const,
  },
  {
    key: "l",
    label: "L",
    sourceKey: "spice.param.l",
    placeholder: "150n",
    help: "Channel length (m)",
    inputMode: "text" as const,
  },
  {
    key: "m",
    label: "M",
    sourceKey: "spice.param.m",
    placeholder: "1",
    help: "Parallel multiplier",
    inputMode: "decimal" as const,
  },
] satisfies readonly ComponentParameter[];

const PARAMETERS_BY_SYMBOL: Readonly<
  Record<string, readonly ComponentParameter[]>
> = {
  resistor: passiveValue("Value", "Resistance (Ω); for example 10k", "10k"),
  capacitor: passiveValue("Value", "Capacitance (F); for example 2p", "2p"),
  inductor: passiveValue("Value", "Inductance (H); for example 3n", "3n"),
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
  const explicit = instance.properties[parameter.key];
  if (typeof explicit === "string" || typeof explicit === "number") {
    return String(explicit);
  }
  const source = parameter.sourceKey
    ? instance.properties[parameter.sourceKey]
    : undefined;
  return typeof source === "string" || typeof source === "number"
    ? String(source)
    : "";
}
