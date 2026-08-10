import { useMemo, useState } from "react";

import { renderSymbolDefinitionBody } from "@icm/render-svg";
import { builtInSymbols, razaviReferencePaletteSymbols } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { defaultRazaviSymbolVariantId } from "./razavi-presentation";

const RETIRED_RAZAVI_SYMBOL_IDS = new Set(["nmos3", "pmos3"]);

export interface ComponentLibraryProps {
  styleProfileId: string;
  onPlace(symbolId: string, symbolName: string): void;
}

function symbolCategory(symbolId: string): string {
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

function SymbolThumbnail({ symbol }: { symbol: SymbolDefinition }) {
  const variantId = defaultRazaviSymbolVariantId(symbol.id);
  const variant = symbol.variants.find(
    (candidate) => candidate.id === variantId,
  );
  const { x, y, width, height } = symbol.viewBox;
  const padding = Math.max(width, height) * 0.12;

  return (
    <svg
      className="palette-symbol-preview"
      viewBox={`${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="#000"
        strokeWidth="1"
        strokeLinecap="square"
        strokeLinejoin="miter"
        dangerouslySetInnerHTML={{
          __html: renderSymbolDefinitionBody(
            symbol,
            variant?.hiddenPrimitiveParts,
            variant?.additionalPrimitives,
          ),
        }}
      />
    </svg>
  );
}

export function ComponentLibrary({
  styleProfileId,
  onPlace,
}: ComponentLibraryProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const groups = useMemo(() => {
    const paletteSource =
      styleProfileId === "razavi-textbook-v1"
        ? razaviReferencePaletteSymbols
        : builtInSymbols;
    const normalizedQuery = query.trim().toLowerCase();
    const symbols = paletteSource.filter(
      (symbol) =>
        symbol.id !== "generic-block" &&
        !RETIRED_RAZAVI_SYMBOL_IDS.has(symbol.id) &&
        `${symbol.name} ${symbol.id} ${symbol.aliases.join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery),
    );

    return [...new Set(symbols.map((symbol) => symbolCategory(symbol.id)))].map(
      (category) => ({
        category,
        symbols: symbols.filter(
          (symbol) => symbolCategory(symbol.id) === category,
        ),
      }),
    );
  }, [query, styleProfileId]);

  return (
    <div className="library-panel">
      <div className="library-heading">
        <h2>Symbols &amp; Tools</h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open ? (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search components"
            aria-label="Search components"
          />
          <details className="library-components" open>
            <summary>Components</summary>
            <div className="library-components-content">
              {groups.map((group) => (
                <details key={group.category} open>
                  <summary>{group.category}</summary>
                  <div className="library-component-grid">
                    {group.symbols.map((symbol) => (
                      <button
                        type="button"
                        key={symbol.id}
                        data-testid={`library-component-${symbol.id}`}
                        title={`Place ${symbol.name}`}
                        onClick={() => onPlace(symbol.id, symbol.name)}
                      >
                        <SymbolThumbnail symbol={symbol} />
                        <span>{symbol.name}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
