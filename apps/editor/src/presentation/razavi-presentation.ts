import type { SchematicEdit } from "@icm/edit-engine";
import { powerDomainForNet } from "@icm/model";
import type { RouteEndpoint, SchematicDocument } from "@icm/model";

const DEFAULT_SYMBOL_VARIANTS: Readonly<Record<string, string>> = {
  nmos: "textbook-3terminal",
  pmos: "textbook-3terminal",
};

const IMPLICIT_BULK_NET_NAMES = new Set([
  "0",
  "gnd",
  "vss",
  "vdd",
  "vssa",
  "vdda",
  "vgnd",
  "vpwr",
]);

const BULK_SUPPLY_BY_SYMBOL: Readonly<Record<string, "VDD" | "0">> = {
  pmos: "VDD",
  nmos: "0",
};

function normalizedSupplyName(value: string | undefined): string | undefined {
  return value?.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
}

function endpointForNet(
  net: SchematicDocument["nets"][number],
): RouteEndpoint | undefined {
  const terminal = net.terminals[0];
  if (terminal) return { kind: "terminal", ...terminal };
  const portId = net.ports[0];
  return portId ? { kind: "port", portId } : undefined;
}

function endpointHasNoConnect(
  document: SchematicDocument,
  instanceId: string,
  pinName: string,
): boolean {
  return document.noConnects.some(
    (noConnect) =>
      noConnect.endpoint.kind === "terminal" &&
      noConnect.endpoint.instanceId === instanceId &&
      noConnect.endpoint.pinName === pinName,
  );
}

function endpointNet(
  document: SchematicDocument,
  instanceId: string,
  pinName: string,
): SchematicDocument["nets"][number] | undefined {
  return document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instanceId && terminal.pinName === pinName,
    ),
  );
}

function matchingGlobalSupply(
  document: SchematicDocument,
  supplyName: "VDD" | "0",
): SchematicDocument["nets"][number] | undefined {
  const canonicalNames =
    supplyName === "VDD"
      ? new Set(["vdd", "vdda", "vddd", "vcc", "vpwr"])
      : new Set(["0", "gnd", "vss", "vssa", "vssd", "vee", "vgnd"]);
  return document.nets.find(
    (net) =>
      powerDomainForNet(document, net) ===
        (supplyName === "VDD" ? "vdd" : "ground") ||
      (net.scope === "global" &&
        [net.name, net.id]
          .map(normalizedSupplyName)
          .some((name) => name !== undefined && canonicalNames.has(name))),
  );
}

/**
 * Textbook MOS artwork can hide B, never erase it. New manually authored MOS
 * may join an already explicit matching global supply, but imported/source-bound
 * devices, NoConnect declarations, body-bias Nets, and missing supplies remain
 * untouched so the electrical model cannot be silently guessed.
 */
export function razaviManualBulkConnectionEdits(
  document: SchematicDocument,
  instances: readonly SchematicDocument["instances"][number][],
): SchematicEdit[] {
  return instances.flatMap((instance) => {
    const supplyName = BULK_SUPPLY_BY_SYMBOL[instance.symbolId];
    if (
      !supplyName ||
      instance.sourceRef ||
      instance.binding ||
      endpointNet(document, instance.id, "B") ||
      endpointHasNoConnect(document, instance.id, "B")
    ) {
      return [];
    }
    const supply = matchingGlobalSupply(document, supplyName);
    const target = supply && endpointForNet(supply);
    return target
      ? [
          {
            kind: "connect_endpoints" as const,
            from: {
              kind: "terminal" as const,
              instanceId: instance.id,
              pinName: "B",
            },
            to: target,
          },
        ]
      : [];
  });
}

/**
 * Razavi is the sole current presentation family. Canonical MOS definitions
 * retain D/G/S/B electrically, while this variant controls the approved
 * visible three-terminal body and source arrow.
 */
export function defaultRazaviSymbolVariantId(
  symbolId: string,
): string | undefined {
  return DEFAULT_SYMBOL_VARIANTS[symbolId];
}

export function razaviHiddenBulkRisk(
  document: SchematicDocument,
  instanceId: string,
): SchematicDocument["nets"][number] | undefined {
  const bulkNet = document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instanceId && terminal.pinName === "B",
    ),
  );
  if (!bulkNet || powerDomainForNet(document, bulkNet) !== "none") {
    return undefined;
  }

  const isImplicitSupply = [bulkNet.name, bulkNet.id]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase().replaceAll(/[^a-z0-9]/gu, ""))
    .some((name) => IMPLICIT_BULK_NET_NAMES.has(name));
  return isImplicitSupply ? undefined : bulkNet;
}

/**
 * The B terminal stays in electrical/SPICE data; non-supply B connections are
 * surfaced as hidden-bulk risks instead of changing the visible artwork.
 */
export function razaviMosPresentationEdits(
  document: SchematicDocument,
): SchematicEdit[] {
  return document.instances.flatMap((instance) => {
    const symbolVariantId = defaultRazaviSymbolVariantId(instance.symbolId);
    if (!symbolVariantId || instance.symbolVariantId === symbolVariantId) {
      return [];
    }
    return [
      {
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId,
      },
    ];
  });
}
