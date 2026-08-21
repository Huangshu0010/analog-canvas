import type { SymbolDefinition } from "@icm/symbols";

import { requireRazaviCatalogSymbol } from "@icm/symbols";

/**
 * Editor-only Library entry for placing a Formal Cell Pin. ADR 0034 keeps the
 * two Port roles explicit rather than inferred, so the role is chosen by
 * picking this entry instead of Port; the placed Instance is an ordinary
 * `port` Symbol. Like the Power Rail entry, this definition never reaches the
 * product Symbol Resolver.
 */
export const cellPinPreviewSymbol = {
  ...requireRazaviCatalogSymbol("port"),
  id: "cell-pin",
  name: "Cell Pin",
} satisfies SymbolDefinition;
