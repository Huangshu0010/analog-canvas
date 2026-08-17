import type { Net, NetPowerDomain, SchematicDocument } from "./schema.js";
import { foldNetName } from "./net-contract.js";

/** Explicit electrical supply identity stored by each current Net. */
export type PowerDomain = "vdd" | "ground";

export interface PowerNetNormalization {
  netId: string;
  domain: PowerDomain;
  name?: string;
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
        candidate.id !== net.id &&
        candidate.name !== undefined &&
        foldNetName(candidate.name) === foldNetName(canonicalName),
    );
    const name =
      hasName || canonicalNameAlreadyUsed ? undefined : canonicalName;
    return net.scope === "global" && !name
      ? []
      : [{ netId: net.id, domain, ...(name ? { name } : {}) }];
  });
}
