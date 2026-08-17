import type { Net, NetPowerDomain } from "./schema.js";

/** Explicit supply roles accepted by current power authoring planners. */
export type PowerDomain = "vdd" | "ground";

export function powerDomainForNet(net: Net): NetPowerDomain {
  return net.powerDomain ?? "none";
}
