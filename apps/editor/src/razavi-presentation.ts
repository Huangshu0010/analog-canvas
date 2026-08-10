import type { SchematicEdit } from "@icm/edit-engine";
import type { SchematicDocument } from "@icm/model";

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
  if (!bulkNet) return undefined;

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
