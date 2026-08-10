import { builtInSymbols, razaviReferencePaletteSymbols } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

const RETIRED_RAZAVI_SYMBOL_IDS = new Set(["nmos3", "pmos3"]);

const CATEGORY_ORDER = [
  "Transistors",
  "Passives",
  "Sources",
  "Diodes",
  "Functional",
  "Power and Ports",
] as const;

export interface ComponentCatalogGroup {
  category: string;
  symbols: SymbolDefinition[];
}

export function symbolCategory(symbolId: string): string {
  if (["nmos", "pmos", "nmos3", "pmos3", "npn", "pnp"].includes(symbolId)) {
    return "Transistors";
  }
  if (
    ["resistor", "capacitor", "inductor", "crystal", "transformer"].includes(
      symbolId,
    )
  ) {
    return "Passives";
  }
  if (
    [
      "voltage-source",
      "current-source",
      "ac-voltage-source",
      "pulse-voltage-source",
    ].includes(symbolId)
  ) {
    return "Sources";
  }
  if (["diode", "zener", "schottky", "led"].includes(symbolId)) {
    return "Diodes";
  }
  if (["opamp", "switch-open", "switch-closed"].includes(symbolId)) {
    return "Functional";
  }
  return "Power and Ports";
}

export function paletteSymbols(styleProfileId: string): SymbolDefinition[] {
  const source =
    styleProfileId === "razavi-textbook-v1"
      ? razaviReferencePaletteSymbols
      : builtInSymbols;
  return source.filter(
    (symbol) =>
      symbol.id !== "generic-block" &&
      !RETIRED_RAZAVI_SYMBOL_IDS.has(symbol.id),
  );
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
