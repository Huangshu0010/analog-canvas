import { razaviProductSymbols } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

const CATEGORY_ORDER = [
  "Transistors",
  "Analog Blocks",
  "Passives",
  "Sources",
  "Power and Ports",
] as const;

export interface ComponentCatalogGroup {
  category: string;
  symbols: SymbolDefinition[];
}

export function symbolCategory(symbolId: string): string {
  if (["nmos", "pmos"].includes(symbolId)) {
    return "Transistors";
  }
  if (["resistor", "capacitor", "inductor"].includes(symbolId)) {
    return "Passives";
  }
  if (symbolId === "opamp") {
    return "Analog Blocks";
  }
  if (["voltage-source", "current-source"].includes(symbolId)) {
    return "Sources";
  }
  return "Power and Ports";
}

export function paletteSymbols(_styleProfileId: string): SymbolDefinition[] {
  return [...razaviProductSymbols];
}

function searchableText(symbol: SymbolDefinition): string {
  return `${symbol.name} ${symbol.id} ${symbol.aliases.join(" ")}`.toLowerCase();
}

export function componentCatalog(
  styleProfileId: string,
  query: string,
  recentSymbolIds: readonly string[] = [],
): ComponentCatalogGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  const recentRank = new Map(
    recentSymbolIds.map((symbolId, index) => [symbolId, index]),
  );
  const symbols = paletteSymbols(styleProfileId)
    .filter(
      (symbol) =>
        normalizedQuery.length === 0 ||
        searchableText(symbol).includes(normalizedQuery),
    )
    .sort((left, right) => {
      const leftRank = recentRank.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightRank = recentRank.get(right.id) ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.name.localeCompare(right.name);
    });

  return CATEGORY_ORDER.map((category) => ({
    category,
    symbols: symbols.filter((symbol) => symbolCategory(symbol.id) === category),
  })).filter((group) => group.symbols.length > 0);
}

export function findPaletteSymbol(
  styleProfileId: string,
  symbolId: string,
): SymbolDefinition | undefined {
  return paletteSymbols(styleProfileId).find(
    (symbol) => symbol.id === symbolId,
  );
}

export function flattenComponentCatalog(
  groups: readonly ComponentCatalogGroup[],
): SymbolDefinition[] {
  return groups.flatMap((group) => group.symbols);
}
