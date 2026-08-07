export interface PdkSymbolMapping {
  symbolId: string;
  pinNames: readonly string[];
  source: "exact" | "pdk-rule";
  registryId: string;
}

interface PdkMappingRule {
  id: string;
  pattern: RegExp;
  terminalCount: number;
  symbolId: string;
  pinNames: readonly string[];
}

export interface PdkSymbolMappingOverride {
  modelName: string;
  terminalCount: number;
  symbolId: string;
  pinNames: readonly string[];
  registryId: string;
}

const pdkRules: readonly PdkMappingRule[] = [
  {
    id: "sky130-nfet-four-terminal",
    pattern: /^sky130_fd_pr__nfet_[a-z0-9_]+$/u,
    terminalCount: 4,
    symbolId: "nmos",
    pinNames: ["D", "G", "S", "B"],
  },
  {
    id: "sky130-pfet-four-terminal",
    pattern: /^sky130_fd_pr__pfet_[a-z0-9_]+$/u,
    terminalCount: 4,
    symbolId: "pmos",
    pinNames: ["D", "G", "S", "B"],
  },
  {
    id: "sky130-high-po-three-terminal",
    pattern: /^sky130_fd_pr__res_high_po$/u,
    terminalCount: 3,
    symbolId: "poly-resistor",
    pinNames: ["1", "2", "B"],
  },
];

export function resolvePdkSymbolMapping(
  modelName: string,
  terminalCount: number,
  exactOverrides: readonly PdkSymbolMappingOverride[] = [],
): PdkSymbolMapping | undefined {
  const normalized = modelName.toLowerCase();
  const exact = exactOverrides.find(
    (candidate) =>
      candidate.modelName.toLowerCase() === normalized &&
      candidate.terminalCount === terminalCount &&
      candidate.pinNames.length === terminalCount,
  );
  if (exact) {
    return {
      symbolId: exact.symbolId,
      pinNames: [...exact.pinNames],
      registryId: exact.registryId,
      source: "exact",
    };
  }
  const rule = pdkRules.find(
    (candidate) =>
      candidate.terminalCount === terminalCount &&
      candidate.pattern.test(normalized),
  );
  return rule
    ? {
        symbolId: rule.symbolId,
        pinNames: [...rule.pinNames],
        source: "pdk-rule",
        registryId: rule.id,
      }
    : undefined;
}
