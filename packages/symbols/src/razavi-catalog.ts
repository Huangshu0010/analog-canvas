import {
  razaviCatalogSymbols,
  razaviSemanticPrimitives,
  razaviSymbolCatalogEntries,
  razaviSymbolCatalogIdentity,
} from "./razavi-catalog.generated.js";
import type { SymbolDefinition } from "./schema.js";

export interface RazaviSymbolCatalogEntry {
  symbolId: string;
  name: string;
  category: string;
  source: {
    stencilHash: string;
    masterNameU: string;
    decoderVersion: string;
  };
  reviewStatus: "reviewed" | "provisional";
  pinOrder: string[];
  palette: boolean;
  automaticMappings: string[];
  manualOnlyReason?: string;
  assetPath: string;
  assetHash: string;
}

export interface RazaviSemanticPrimitiveEntry {
  id: string;
  disposition: "semantic-primitive";
  source: {
    stencilHash: string;
    masterNameU: string;
    decoderVersion: string;
  };
  geometry: {
    kind: "circle";
    sourceDiameterIU: number;
    fill: "foreground";
    stroke: "none";
  };
  runtimeOwner: string;
}

const symbolsById = new Map(
  razaviCatalogSymbols.map((symbol) => [symbol.id, symbol]),
);
const entriesById = new Map(
  razaviSymbolCatalogEntries.map((entry) => [entry.symbolId, entry]),
);

export {
  razaviCatalogSymbols,
  razaviSemanticPrimitives,
  razaviSymbolCatalogEntries,
  razaviSymbolCatalogIdentity,
};

export function getRazaviCatalogSymbol(
  symbolId: string,
): SymbolDefinition | undefined {
  return symbolsById.get(symbolId);
}

export function requireRazaviCatalogSymbol(symbolId: string): SymbolDefinition {
  const symbol = getRazaviCatalogSymbol(symbolId);
  if (!symbol) throw new Error(`Unknown Razavi catalog symbol: ${symbolId}`);
  return symbol;
}

export function getRazaviCatalogEntry(
  symbolId: string,
): RazaviSymbolCatalogEntry | undefined {
  return entriesById.get(symbolId);
}
