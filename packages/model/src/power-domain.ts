import type { Net, NetPowerDomain, SchematicDocument } from "./schema.js";

/** Explicit electrical supply identity stored by each current Net. */
export type PowerDomain = "vdd" | "ground";

export interface PowerNetNormalization {
  netId: string;
  domain: PowerDomain;
  name?: string;
}

/**
 * Migration-only legacy inference. No runtime consumer may call this: a v5
 * Net owns its power identity explicitly.
 */
export function inferLegacyPowerDomainForTerminal(
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

export function powerDomainForNet(net: Net): NetPowerDomain {
  return net.powerDomain ?? "none";
}

export function powerNetNormalizations(
  document: SchematicDocument,
): readonly PowerNetNormalization[] {
  return document.nets.flatMap((net) => {
    const domain = powerDomainForNet(net);
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
