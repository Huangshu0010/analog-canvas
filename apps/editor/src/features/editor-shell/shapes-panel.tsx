import { useState } from "react";

import type { SymbolDefinition } from "@icm/symbols";

import type { ComponentInsertRequest } from "../component-insert/component-insert-request";
import {
  fullInsertLaunch,
  type InsertLaunch,
} from "../component-insert/insert-launch";
import { SymbolArtwork } from "../component-insert/symbol-artwork";
import { initialComponentParameterValues } from "../component-insert/component-parameters";
import {
  componentCatalog,
  findPaletteSymbol,
  libraryDescription,
  libraryDisplayName,
} from "../component-insert/symbol-catalog";

/**
 * A tile is 40px wide, so its label is an abbreviation — "Cap", "Res", "NPN".
 * Cell Pins shorten to "Pin"; the full name remains in the tooltip and Insert
 * dialog, where there is room to read it.
 */
const COMPACT_LIBRARY_LABELS: Readonly<Record<string, string>> = {
  capacitor: "Cap",
  "closed-switch": "Closed",
  "current-source": "I Src",
  "ideal-switch": "Open",
  inductor: "Ind L",
  "inductor-compact": "Ind",
  npn: "NPN",
  opamp: "OpAmp",
  "opamp-differential": "FD Amp",
  "opamp-differential-crossed": "FD Amp X",
  "and-gate": "AND",
  comparator: "Comp",
  inverter: "Inv",
  "nand-gate": "NAND",
  "nor-gate": "NOR",
  "or-gate": "OR",
  "xnor-gate": "XNOR",
  "xor-gate": "XOR",
  pnp: "PNP",
  port: "Pin",
  "port-filled": "Pin \u2022",
  resistor: "Res",
  "variable-capacitor": "Var Cap",
  "variable-inductor": "Var Ind",
  "variable-resistor": "Var Res",
  vdd: "VDD Rail",
  "vdd-port": "VDD",
  "voltage-amplifier": "V Amp",
  "voltage-source": "V Src",
};

function libraryLabel(symbolId: string, symbolName: string): string {
  return (
    COMPACT_LIBRARY_LABELS[symbolId] ?? libraryDisplayName(symbolId, symbolName)
  );
}

function categorySlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function quickPlaceRequest(
  styleProfileId: string,
  symbolId: string,
): ComponentInsertRequest | null {
  const symbol = findPaletteSymbol(styleProfileId, symbolId);
  if (!symbol) return null;
  if (symbolId === "vdd") {
    return {
      kind: "vdd-rail",
      symbolId: "vdd",
      symbolName: "Power Rail",
      netName: "VDD",
    };
  }
  if (symbolId === "port" || symbolId === "port-filled") {
    return {
      kind: "symbol",
      symbolId,
      symbolName: symbol.name,
      parameters: {},
      initialRotation: 0,
      showReference: false,
      referenceText: null,
      showValue: false,
      portDirection: "passive",
    };
  }
  return {
    kind: "symbol",
    symbolId: symbol.id,
    symbolName: symbol.name,
    // Quick-place follows the full Insert dialog's existing blank-value
    // semantics. Placeholders remain hints rather than silently persisted
    // electrical parameters.
    parameters: initialComponentParameterValues(symbolId),
    initialRotation: 0,
    showReference: true,
    referenceText: null,
    showValue: false,
  };
}

/**
 * A user-defined symbol (ADR 0047) is a manual-only device: no device
 * descriptor means no parameters and no netlist emission, exactly like the
 * reviewed op-amp and logic-gate treatment.
 */
export function quickCustomSymbolRequest(
  symbol: SymbolDefinition,
): ComponentInsertRequest {
  return {
    kind: "symbol",
    symbolId: symbol.id,
    symbolName: symbol.name,
    parameters: {},
    initialRotation: 0,
    showReference: true,
    referenceText: null,
    showValue: false,
  };
}

export interface ShapesPanelProps {
  styleProfileId: string;
  open: boolean;
  /** Runtime custom symbols (ADR 0047), already namespaced by definition ID. */
  customSymbols?: readonly SymbolDefinition[];
  onStartInsert(launch: InsertLaunch): void;
}

export function ShapesPanel({
  styleProfileId,
  open,
  customSymbols = [],
  onStartInsert,
}: ShapesPanelProps) {
  const libraryGroups = componentCatalog(styleProfileId, "");
  const librarySymbolCount = libraryGroups.reduce(
    (count, group) => count + group.symbols.length,
    0,
  );
  const [openCategories, setOpenCategories] = useState<ReadonlySet<string>>(
    () => new Set(libraryGroups.map((group) => group.category)),
  );

  function placeSymbol(symbolId: string): void {
    const request = quickPlaceRequest(styleProfileId, symbolId);
    if (request) onStartInsert({ kind: "quick", request });
  }

  function placeCustomSymbol(symbol: SymbolDefinition): void {
    onStartInsert({ kind: "quick", request: quickCustomSymbolRequest(symbol) });
  }

  function setCategoryOpen(category: string, open: boolean): void {
    setOpenCategories((current) => {
      if (current.has(category) === open) return current;
      const next = new Set(current);
      if (open) next.add(category);
      else next.delete(category);
      return next;
    });
  }

  return (
    <aside
      id="shapes-library-panel"
      className={open ? "shapes-panel" : "shapes-panel collapsed"}
      aria-label="Shapes"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      data-testid="shapes-library-panel"
      data-open={open ? "true" : "false"}
    >
      <div className="shapes-panel-body">
        <details className="shapes-fold" open data-testid="shapes-fold-library">
          <summary className="shapes-fold-summary">
            <span className="shapes-fold-label">
              <span className="shapes-fold-label-full">All devices</span>
              <span className="shapes-fold-label-compact">All</span>
            </span>
            <span className="shapes-fold-count">{librarySymbolCount}</span>
          </summary>
          <div className="shapes-fold-body">
            <div className="shapes-category-list">
              {libraryGroups.map((group) => (
                <details
                  key={group.category}
                  className="shapes-category"
                  open={openCategories.has(group.category)}
                  data-testid={`shapes-category-${categorySlug(group.category)}`}
                  onToggle={(event) =>
                    setCategoryOpen(group.category, event.currentTarget.open)
                  }
                >
                  <summary className="shapes-category-header">
                    <span className="shapes-category-label">
                      {group.category}
                    </span>
                    <span className="shapes-category-count">
                      {group.symbols.length}
                    </span>
                  </summary>
                  <div className="shapes-grid">
                    {group.symbols.map((symbol) => (
                      <button
                        key={symbol.id}
                        type="button"
                        className="shapes-chip"
                        data-testid={`shapes-chip-${symbol.id}`}
                        data-vdd-rail={symbol.id === "vdd" ? "true" : undefined}
                        aria-label={`Place ${libraryDisplayName(
                          symbol.id,
                          symbol.name,
                        )}`}
                        title={
                          libraryDescription(symbol.id) ??
                          `Place ${libraryDisplayName(symbol.id, symbol.name)}`
                        }
                        onClick={() => placeSymbol(symbol.id)}
                      >
                        <SymbolArtwork
                          symbol={symbol}
                          className="shapes-chip-art"
                          paddingRatio={0.04}
                        />
                        <span>{libraryLabel(symbol.id, symbol.name)}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>
        <details
          className="shapes-fold"
          open={customSymbols.length > 0}
          data-testid="shapes-fold-custom"
        >
          <summary className="shapes-fold-summary">
            <span className="shapes-fold-label">
              <span className="shapes-fold-label-full">Custom symbols</span>
              <span className="shapes-fold-label-compact">Custom</span>
            </span>
            <span className="shapes-fold-count">{customSymbols.length}</span>
          </summary>
          <div className="shapes-fold-body">
            {customSymbols.length === 0 ? (
              <p className="shapes-fold-hint">
                Import a Symbol DSL .json file from the File menu to add your
                own symbols here. They are saved with this project.
              </p>
            ) : (
              <div className="shapes-grid">
                {customSymbols.map((symbol) => (
                  <button
                    key={symbol.id}
                    type="button"
                    className="shapes-chip"
                    data-testid={`shapes-chip-${symbol.id}`}
                    aria-label={`Place ${symbol.name}`}
                    title={`Place ${symbol.name} (imported)`}
                    onClick={() => placeCustomSymbol(symbol)}
                  >
                    <SymbolArtwork
                      symbol={symbol}
                      className="shapes-chip-art"
                      paddingRatio={0.04}
                    />
                    <span>{symbol.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>

      <footer className="shapes-panel-footer">
        <button
          type="button"
          className="shapes-insert"
          data-testid="shapes-insert"
          onClick={() => onStartInsert(fullInsertLaunch())}
          title="Insert component with parameters (I)"
        >
          Insert
          <kbd>I</kbd>
        </button>
      </footer>
    </aside>
  );
}
