import { useEffect, useMemo, useRef, useState } from "react";

import { renderSymbolDefinitionBody } from "@icm/render-svg";
import type { SymbolDefinition } from "@icm/symbols";

import { defaultRazaviSymbolVariantId } from "../../presentation/razavi-presentation";
import {
  componentParameters,
  initialComponentParameterValues,
} from "./component-parameters";
import {
  componentCatalog,
  findPaletteSymbol,
  flattenComponentCatalog,
} from "./symbol-catalog";

export interface InsertComponentDialogProps {
  open: boolean;
  styleProfileId: string;
  recentSymbolIds: readonly string[];
  onApply(request: ComponentInsertRequest): void;
  onCancel(): void;
}

export interface ComponentInsertRequest {
  symbolId: string;
  symbolName: string;
  properties: Record<string, string>;
  initialRotation: 0 | 90 | 180 | 270;
  showReference: boolean;
  referenceText: string | null;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(
    () => initialSymbols[0]?.id ?? null,
  );
  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});
  const [initialRotation, setInitialRotation] = useState<0 | 90 | 180 | 270>(0);
  const [showReference, setShowReference] = useState(true);
  const [referenceText, setReferenceText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(
    () => componentCatalog(styleProfileId, query, recentSymbolIds),
    [query, recentSymbolIds, styleProfileId],
  );
  const symbols = useMemo(() => flattenComponentCatalog(groups), [groups]);
  const selected =
    symbols.find((symbol) => symbol.id === selectedId) ?? symbols[0] ?? null;
  const parameters = componentParameters(selected?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPickerOpen(false);
    setSelectedId(initialSymbols[0]?.id ?? null);
    setInitialRotation(0);
    setShowReference(true);
    setReferenceText("");
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [initialSymbols, open]);

  useEffect(() => {
    setParameterValues(initialComponentParameterValues(selected?.id ?? ""));
  }, [selected?.id]);

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
    setPickerOpen(true);
  };

  const selectSymbol = (symbolId: string): void => {
    setSelectedId(symbolId);
    setQuery("");
    setPickerOpen(false);
  };

  const apply = (): void => {
    if (!selected) return;
    const properties = Object.fromEntries(
      Object.entries(parameterValues)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ""),
    );
    const trimmedReference = referenceText.trim();
    onApply({
      symbolId: selected.id,
      symbolName: selected.name,
      properties,
      initialRotation,
      showReference,
      referenceText: trimmedReference === "" ? null : trimmedReference,
    });
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
            setPickerOpen(true);
            setSelectedId(symbols[0]?.id ?? null);
          } else if (event.key === "End") {
            event.preventDefault();
            setPickerOpen(true);
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

        <div className="insert-dialog-body">
          <aside className="insert-control-column" aria-label="Device setup">
            <section className="insert-component-picker">
              <label className="insert-search-field">
                <span>Component</span>
                <div className="insert-picker-input-row">
                  <input
                    ref={inputRef}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={pickerOpen}
                    aria-controls="insert-component-options"
                    aria-activedescendant={
                      selected
                        ? `insert-component-option-${selected.id}`
                        : undefined
                    }
                    value={query}
                    placeholder={
                      selected
                        ? `${selected.name} · ${selected.id}`
                        : "Search component"
                    }
                    onChange={(event) => {
                      setQuery(event.currentTarget.value);
                      setPickerOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    className="insert-picker-toggle"
                    aria-label={
                      pickerOpen
                        ? "Collapse component list"
                        : "Expand component list"
                    }
                    aria-expanded={pickerOpen}
                    onClick={() => setPickerOpen((current) => !current)}
                  >
                    {pickerOpen ? "⌃" : "⌄"}
                  </button>
                </div>
              </label>
              {pickerOpen ? (
                <div
                  id="insert-component-options"
                  className="insert-component-options"
                  role="listbox"
                  aria-label="Component choices"
                >
                  {groups.map((group) => (
                    <section
                      key={group.category}
                      className="insert-option-group"
                    >
                      <h3>{group.category}</h3>
                      {group.symbols.map((symbol) => (
                        <button
                          type="button"
                          id={`insert-component-option-${symbol.id}`}
                          key={symbol.id}
                          role="option"
                          aria-selected={symbol.id === selected?.id}
                          data-testid={`insert-component-${symbol.id}`}
                          onClick={() => selectSymbol(symbol.id)}
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
              ) : null}
            </section>

            <section
              className="insert-control-section"
              aria-label="Orientation"
            >
              <h3>Orientation</h3>
              <div
                className="insert-rotation-options"
                role="group"
                aria-label="Initial rotation"
              >
                {([0, 90, 180, 270] as const).map((rotation) => (
                  <button
                    type="button"
                    key={rotation}
                    aria-pressed={initialRotation === rotation}
                    onClick={() => setInitialRotation(rotation)}
                  >
                    {rotation}°
                  </button>
                ))}
              </div>
              <small>R rotates the preview before placement.</small>
            </section>

            <section
              className="insert-control-section"
              aria-label="Reference annotation"
            >
              <h3>Reference annotation</h3>
              <label className="insert-reference-toggle">
                <input
                  type="checkbox"
                  checked={showReference}
                  onChange={(event) =>
                    setShowReference(event.currentTarget.checked)
                  }
                />
                <span>Show reference</span>
              </label>
              <label>
                <span>Reference text (optional)</span>
                <input
                  aria-label="Reference text"
                  value={referenceText}
                  disabled={!showReference}
                  placeholder="Automatic instance name"
                  onChange={(event) =>
                    setReferenceText(event.currentTarget.value)
                  }
                />
              </label>
            </section>

            {parameters.length > 0 ? (
              <section
                className="insert-control-section"
                aria-label="Device parameters"
              >
                <h3>Device parameters</h3>
                {parameters.map((parameter) => (
                  <label key={parameter.key} title={parameter.help}>
                    <span>{parameter.label}</span>
                    <input
                      aria-label={`Component ${parameter.label.toLowerCase()}`}
                      inputMode={parameter.inputMode}
                      value={parameterValues[parameter.key] ?? ""}
                      placeholder={parameter.placeholder}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setParameterValues((current) => ({
                          ...current,
                          [parameter.key]: value,
                        }));
                      }}
                    />
                    <small>{parameter.help}</small>
                  </label>
                ))}
              </section>
            ) : null}
          </aside>

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
          <small>Type to search · ↑↓ choose · Enter place · Esc cancel</small>
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
