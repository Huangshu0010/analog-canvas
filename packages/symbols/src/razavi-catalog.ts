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
  reviewStatus: "reviewed" | "provisional";
  visualAuthority:
    | {
        kind: "razavi-reference-v1";
        referenceManifestPath: string;
        referencePaths: string[];
        calibrationPath?: string;
      }
    | {
        kind: "legacy-compatibility";
        reason: string;
      };
  pinOrder: string[];
  palette: boolean;
  automaticMappings: string[];
  manualOnlyReason?: string;
  assetPath: string;
  assetHash: string;
  generation?: {
    kind: "razavi-raster-reference";
    referenceManifestPath: string;
    referencePath: string;
    converterPath: string;
    converterVersion: number;
  };
}

export interface RazaviSemanticPrimitiveEntry {
  id: string;
  disposition: "semantic-primitive";
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

export function isRazaviReferencePaletteEntry(
  entry: RazaviSymbolCatalogEntry,
): boolean {
  return (
    entry.palette &&
    entry.reviewStatus === "reviewed" &&
    entry.visualAuthority.kind === "razavi-reference-v1"
  );
}

export const razaviReferencePaletteSymbols: readonly SymbolDefinition[] =
  razaviSymbolCatalogEntries
    .filter(isRazaviReferencePaletteEntry)
    .map((entry) => symbolsById.get(entry.symbolId)!)
    .filter((symbol): symbol is SymbolDefinition => symbol !== undefined);

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
