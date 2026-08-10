import { useEffect, useMemo, useRef, useState } from "react";

import { renderSymbolDefinitionBody } from "@icm/render-svg";
import type { SymbolDefinition } from "@icm/symbols";

import { defaultRazaviSymbolVariantId } from "../../razavi-presentation";
import {
  componentCatalog,
  findPaletteSymbol,
  flattenComponentCatalog,
} from "./symbol-catalog";

export interface InsertComponentDialogProps {
  open: boolean;
  styleProfileId: string;
  recentSymbolIds: readonly string[];
  onApply(symbolId: string, symbolName: string): void;
  onCancel(): void;
}

export function SymbolArtwork({
  symbol,
  className,
}: {
  symbol: SymbolDefinition;
  className: string;
}) {
  const variantId = defaultRazaviSymbolVariantId(symbol.id);
  const variant = symbol.variants.find(
    (candidate) => candidate.id === variantId,
  );
  const { x, y, width, height } = symbol.viewBox;
  const padding = Math.max(width, height) * 0.18;

  return (
    <svg
      className={className}
      viewBox={`${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
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

export function ComponentPlacementPreview({
  styleProfileId,
  symbolId,
  position,
  rotation,
}: {
  styleProfileId: string;
  symbolId: string;
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
}) {
  const symbol = findPaletteSymbol(styleProfileId, symbolId);
  if (!symbol) return null;
  const variantId = defaultRazaviSymbolVariantId(symbol.id);
  const variant = symbol.variants.find(
    (candidate) => candidate.id === variantId,
  );

  return (
    <g
      data-testid="component-placement-preview"
      className="component-placement-preview"
      transform={`translate(${position.x} ${position.y}) rotate(${rotation})`}
      fill="none"
      stroke="currentColor"
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
  );
}

export function InsertComponentDialog({
  open,
  styleProfileId,
  recentSymbolIds,
  onApply,
  onCancel,
}: InsertComponentDialogProps) {
  const initialSymbols = useMemo(
    () =>
      flattenComponentCatalog(
        componentCatalog(styleProfileId, "", recentSymbolIds),
      ),
    [recentSymbolIds, styleProfileId],
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => initialSymbols[0]?.id ?? null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(
    () => componentCatalog(styleProfileId, query, recentSymbolIds),
    [query, recentSymbolIds, styleProfileId],
  );
  const symbols = useMemo(() => flattenComponentCatalog(groups), [groups]);
  const selected =
    symbols.find((symbol) => symbol.id === selectedId) ?? symbols[0] ?? null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(initialSymbols[0]?.id ?? null);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSymbols, open]);

  useEffect(() => {
    if (symbols.length === 0) {
      setSelectedId(null);
    } else if (!symbols.some((symbol) => symbol.id === selectedId)) {
      setSelectedId(symbols[0]!.id);
    }
  }, [selectedId, symbols]);

  if (!open) return null;

  const selectOffset = (offset: number): void => {
    if (symbols.length === 0) return;
    const index = Math.max(
      0,
      symbols.findIndex((symbol) => symbol.id === selected?.id),
    );
    const next = (index + offset + symbols.length) % symbols.length;
    setSelectedId(symbols[next]!.id);
  };

  const apply = (): void => {
    if (selected) onApply(selected.id, selected.name);
  };

  return (
    <div
      className="insert-dialog-backdrop"
      data-testid="insert-component-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="insert-component-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-component-title"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            selectOffset(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            selectOffset(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setSelectedId(symbols[0]?.id ?? null);
          } else if (event.key === "End") {
            event.preventDefault();
            setSelectedId(symbols.at(-1)?.id ?? null);
          }
        }}
      >
        <header className="insert-dialog-header">
          <div>
            <p>Place device</p>
            <h2 id="insert-component-title">Insert Component</h2>
          </div>
          <kbd>I</kbd>
        </header>

        <label className="insert-search-field">
          <span>Search or choose a component</span>
          <input
            ref={inputRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="insert-component-options"
            aria-activedescendant={
              selected ? `insert-component-option-${selected.id}` : undefined
            }
            value={query}
            placeholder="Type a name, ID, or alias…"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>

        <div className="insert-dialog-body">
          <div
            id="insert-component-options"
            className="insert-component-options"
            role="listbox"
            aria-label="Component choices"
          >
            {groups.map((group) => (
              <section key={group.category} className="insert-option-group">
                <h3>{group.category}</h3>
                {group.symbols.map((symbol) => (
                  <button
                    type="button"
                    id={`insert-component-option-${symbol.id}`}
                    key={symbol.id}
                    role="option"
                    aria-selected={symbol.id === selected?.id}
                    data-testid={`insert-component-${symbol.id}`}
                    onClick={() => setSelectedId(symbol.id)}
                  >
                    <span>{symbol.name}</span>
                    <small>{symbol.id}</small>
                  </button>
                ))}
              </section>
            ))}
            {symbols.length === 0 ? (
              <p className="insert-no-results">No matching components</p>
            ) : null}
          </div>

          <section className="insert-component-preview" aria-live="polite">
            {selected ? (
              <>
                <SymbolArtwork
                  symbol={selected}
                  className="insert-symbol-artwork"
                />
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.id}</p>
                  {selected.aliases.length > 0 ? (
                    <small>{selected.aliases.join(" · ")}</small>
                  ) : null}
                </div>
              </>
            ) : (
              <p>Select a component to preview it.</p>
            )}
          </section>
        </div>

        <footer className="insert-dialog-actions">
          <small>↑↓ choose · Enter place · Esc cancel</small>
          <div>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!selected}>
              Apply
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
