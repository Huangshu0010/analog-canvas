import type { Net, SchematicDocument } from "./schema.js";

/**
 * Electrical intent carried by a reviewed Razavi power-symbol terminal. This
 * is derived from persisted terminal membership rather than a Net's display
 * name, which may be absent or user-defined.
 */
export type PowerDomain = "vdd" | "ground";
export type NetPowerDomain = PowerDomain | "none" | "conflict";

export interface PowerNetNormalization {
  netId: string;
  domain: PowerDomain;
  name?: string;
}

export function powerDomainForTerminal(
  document: SchematicDocument,
  terminal: Net["terminals"][number],
): PowerDomain | undefined {
  const instance = document.instances.find(
    (candidate) => candidate.id === terminal.instanceId,
  );
  if (instance?.symbolId === "vdd" && terminal.pinName === "P") {
    return "vdd";
  }
  if (instance?.symbolId === "ground" && terminal.pinName === "0") {
    return "ground";
  }
  return undefined;
}

export function powerDomainForNet(
  document: SchematicDocument,
  net: Net,
): NetPowerDomain {
  const domains = new Set(
    net.terminals.flatMap((terminal) => {
      const domain = powerDomainForTerminal(document, terminal);
      return domain ? [domain] : [];
    }),
  );
  if (domains.size === 0) return "none";
  if (domains.size > 1) return "conflict";
  return [...domains][0]!;
}

export function powerNetNormalizations(
  document: SchematicDocument,
): readonly PowerNetNormalization[] {
  return document.nets.flatMap((net) => {
    const domain = powerDomainForNet(document, net);
    if (domain === "none" || domain === "conflict") return [];
    const canonicalName = domain === "vdd" ? "VDD" : "0";
    const hasName = Boolean(net.name?.trim());
    const canonicalNameAlreadyUsed = document.nets.some(
      (candidate) =>
        candidate.id !== net.id && candidate.name === canonicalName,
    );
    const name =
      hasName || canonicalNameAlreadyUsed ? undefined : canonicalName;
    return net.scope === "global" && !name
      ? []
      : [{ netId: net.id, domain, ...(name ? { name } : {}) }];
  });
}
