import { useEffect, useMemo, useRef, useState } from "react";

import { displayableInstanceValue } from "@icm/derived";
import { renderSymbolDefinitionBody } from "@icm/render-svg";
import type { SymbolDefinition } from "@icm/symbols";

import { defaultRazaviSymbolVariantId } from "../../presentation/razavi-presentation";
import {
  componentParameters,
  initialComponentParameterValues,
} from "./component-parameters";
import { componentCatalog, findPaletteSymbol } from "./symbol-catalog";
import type { ComponentInsertRequest } from "./component-insert-request";
import { DisplayToggle } from "./display-toggle";
import { SymbolArtwork } from "./symbol-artwork";

export type { ComponentInsertRequest } from "./component-insert-request";

export interface InsertComponentDialogProps {
  open: boolean;
  styleProfileId: string;
  recentSymbolIds: readonly string[];
  cells: readonly CellInsertCandidate[];
  cellOnly?: boolean;
  onApply(request: ComponentInsertRequest): void;
  onCancel(): void;
}

export interface CellInsertCandidate {
  readonly childDocumentId: string;
  readonly cellName: string;
  readonly symbol: SymbolDefinition;
}

interface InsertChoice {
  readonly key: string;
  readonly kind: "symbol" | "cell";
  readonly symbol: SymbolDefinition;
  readonly childDocumentId?: string;
  readonly cellName?: string;
}

export function ComponentPlacementPreview({
  styleProfileId,
  symbolId,
  symbol,
  position,
  rotation,
  mirror = "none",
}: {
  styleProfileId: string;
  symbolId: string;
  symbol?: SymbolDefinition;
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
  mirror?: "none" | "x";
}) {
  const definition = symbol ?? findPaletteSymbol(styleProfileId, symbolId);
  if (!definition) return null;
  const variantId = defaultRazaviSymbolVariantId(definition.id);
  const variant = definition.variants.find(
    (candidate) => candidate.id === variantId,
  );

  return (
    <g
      data-testid="component-placement-preview"
      className="component-placement-preview"
      transform={`translate(${position.x} ${position.y}) rotate(${rotation})${
        mirror === "x" ? " scale(-1 1)" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="square"
      strokeLinejoin="miter"
      dangerouslySetInnerHTML={{
        __html: renderSymbolDefinitionBody(
          definition,
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
  cells,
  cellOnly = false,
  onApply,
  onCancel,
}: InsertComponentDialogProps) {
  const initialChoices = useMemo<InsertChoice[]>(
    () => [
      ...(cellOnly
        ? []
        : componentCatalog(styleProfileId, "", recentSymbolIds).flatMap(
            (group) =>
              group.symbols.map((symbol) => ({
                key: symbol.id,
                kind: "symbol" as const,
                symbol,
              })),
          )),
      ...cells.map((cell) => ({
        key: `cell:${cell.childDocumentId}`,
        kind: "cell" as const,
        symbol: cell.symbol,
        childDocumentId: cell.childDocumentId,
        cellName: cell.cellName,
      })),
    ],
    [cellOnly, cells, recentSymbolIds, styleProfileId],
  );
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(
    () => initialChoices[0]?.key ?? null,
  );
  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});
  const [initialRotation, setInitialRotation] = useState<0 | 90 | 180 | 270>(0);
  const [showReference, setShowReference] = useState(true);
  const [referenceText, setReferenceText] = useState("");
  const [showValue, setShowValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo<
    { category: string; choices: InsertChoice[] }[]
  >(() => {
    const cellChoices = cells
      .filter((cell) => {
        const normalized = query.trim().toLowerCase();
        return (
          normalized.length === 0 ||
          `${cell.cellName} ${cell.symbol.id}`
            .toLowerCase()
            .includes(normalized)
        );
      })
      .map<InsertChoice>((cell) => ({
        key: `cell:${cell.childDocumentId}`,
        kind: "cell",
        symbol: cell.symbol,
        childDocumentId: cell.childDocumentId,
        cellName: cell.cellName,
      }));
    return [
      ...(cellOnly
        ? []
        : componentCatalog(styleProfileId, query, recentSymbolIds).map(
            (group) => ({
              category: group.category,
              choices: group.symbols.map<InsertChoice>((symbol) => ({
                key: symbol.id,
                kind: "symbol",
                symbol,
              })),
            }),
          )),
      ...(cellChoices.length > 0
        ? [{ category: "Cells", choices: cellChoices }]
        : []),
    ];
  }, [cellOnly, cells, query, recentSymbolIds, styleProfileId]);
  const choices = useMemo(
    () => groups.flatMap((group) => group.choices),
    [groups],
  );
  const selected =
    choices.find((choice) => choice.key === selectedId) ?? choices[0] ?? null;
  const selectedIsVddRail =
    selected?.kind === "symbol" && selected.symbol.id === "vdd";
  const selectedIsPort =
    selected?.kind === "symbol" &&
    (selected.symbol.id === "port" || selected.symbol.id === "port-filled");
  const parameters = componentParameters(
    selected?.kind === "symbol" ? selected.symbol.id : "",
  );
  const valueDisplay = displayableInstanceValue({
    symbolId: selected?.kind === "symbol" ? selected.symbol.id : "",
    properties: Object.fromEntries(
      Object.entries(parameterValues)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ""),
    ),
  });
  const valueAvailable =
    selected?.kind === "cell" || valueDisplay.kind === "displayable";

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPickerOpen(true);
    setSelectedId(initialChoices[0]?.key ?? null);
    setInitialRotation(0);
    setShowReference(true);
    setReferenceText("");
    setShowValue(false);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [initialChoices, open]);

  useEffect(() => {
    setParameterValues(
      initialComponentParameterValues(
        selected?.kind === "symbol" ? selected.symbol.id : "",
      ),
    );
  }, [selected]);

  useEffect(() => {
    if (selected?.kind === "cell") setShowValue(true);
  }, [selected?.kind]);

  useEffect(() => {
    if (choices.length === 0) {
      setSelectedId(null);
    } else if (!choices.some((choice) => choice.key === selectedId)) {
      setSelectedId(choices[0]!.key);
    }
  }, [choices, selectedId]);

  if (!open) return null;

  const selectOffset = (offset: number): void => {
    if (choices.length === 0) return;
    const index = Math.max(
      0,
      choices.findIndex((choice) => choice.key === selected?.key),
    );
    const next = (index + offset + choices.length) % choices.length;
    setSelectedId(choices[next]!.key);
    setPickerOpen(true);
  };

  const selectChoice = (key: string): void => {
    setSelectedId(key);
    setQuery("");
    setPickerOpen(false);
  };

  const rotatePreview = (): void => {
    if (selectedIsVddRail) return;
    setInitialRotation(
      (current) => ((current + 90) % 360) as 0 | 90 | 180 | 270,
    );
  };

  const apply = (): void => {
    if (!selected) return;
    if (selectedIsVddRail) {
      onApply({
        kind: "vdd-rail",
        symbolId: "vdd",
        symbolName: "VDD Rail",
      });
      return;
    }
    if (selected.kind === "cell") {
      onApply({
        kind: "cell",
        symbolId: selected.symbol.id,
        symbolName: selected.cellName ?? selected.symbol.name,
        childDocumentId: selected.childDocumentId!,
        cellName: selected.cellName ?? selected.symbol.name,
        properties: {},
        initialRotation,
        showReference: false,
        referenceText: null,
        showValue: true,
      });
      return;
    }
    const properties = Object.fromEntries(
      Object.entries(parameterValues)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ""),
    );
    const trimmedReference = referenceText.trim();
    onApply({
      kind: "symbol",
      symbolId: selected.symbol.id,
      symbolName: selected.symbol.name,
      properties,
      initialRotation,
      showReference,
      referenceText: trimmedReference === "" ? null : trimmedReference,
      showValue: showValue && valueAvailable,
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
          const target = event.target as HTMLElement;
          const isTextEntry = Boolean(
            target.closest('input, textarea, [contenteditable="true"]'),
          );
          if (
            event.key.toLowerCase() === "r" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !isTextEntry
          ) {
            event.preventDefault();
            rotatePreview();
          } else if (event.key === "Escape") {
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
            setSelectedId(choices[0]?.key ?? null);
          } else if (event.key === "End") {
            event.preventDefault();
            setPickerOpen(true);
            setSelectedId(choices.at(-1)?.key ?? null);
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
                    aria-label="Component search"
                    aria-autocomplete="list"
                    aria-expanded={pickerOpen}
                    aria-controls="insert-component-options"
                    aria-activedescendant={
                      selected
                        ? `insert-component-option-${selected.key}`
                        : undefined
                    }
                    value={query}
                    placeholder={
                      selected
                        ? `${selected.cellName ?? selected.symbol.name} · ${selected.symbol.id}`
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
                      {group.choices.map((choice) => (
                        <button
                          type="button"
                          id={`insert-component-option-${choice.key}`}
                          key={choice.key}
                          role="option"
                          aria-selected={choice.key === selected?.key}
                          data-testid={
                            choice.kind === "cell"
                              ? `insert-cell-${choice.childDocumentId}`
                              : `insert-component-${choice.symbol.id}`
                          }
                          onClick={() => selectChoice(choice.key)}
                        >
                          <span>{choice.cellName ?? choice.symbol.name}</span>
                          <small>
                            {choice.kind === "cell" ? "Cell" : choice.symbol.id}
                          </small>
                        </button>
                      ))}
                    </section>
                  ))}
                  {choices.length === 0 ? (
                    <p className="insert-no-results">No matching components</p>
                  ) : null}
                </div>
              ) : null}
            </section>

            {!selectedIsVddRail ? (
              <section
                className="insert-placement-options"
                aria-label="Placement options"
              >
                <label className="insert-rotation-control">
                  <span>Rotate</span>
                  <select
                    aria-label="Initial rotation"
                    value={initialRotation}
                    onChange={(event) =>
                      setInitialRotation(
                        Number(event.currentTarget.value) as 0 | 90 | 180 | 270,
                      )
                    }
                  >
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                  </select>
                </label>
                {selected?.kind === "cell" ? (
                  <p className="insert-cell-label-note">
                    Cell label: {selected.cellName ?? selected.symbol.name}
                  </p>
                ) : selectedIsPort ? (
                  <p className="insert-cell-label-note">
                    Port name and direction can be edited after placement.
                  </p>
                ) : (
                  <div className="insert-label-control">
                    <DisplayToggle
                      label="Reference"
                      checked={showReference}
                      onChange={setShowReference}
                    />
                    <input
                      aria-label="Reference name"
                      value={referenceText}
                      disabled={!showReference}
                      placeholder="Name (auto)"
                      onChange={(event) =>
                        setReferenceText(event.currentTarget.value)
                      }
                    />
                    <DisplayToggle
                      label="Value"
                      checked={showValue}
                      disabled={!valueAvailable}
                      help={
                        valueAvailable
                          ? undefined
                          : "Fill the device parameters first"
                      }
                      onChange={setShowValue}
                    />
                  </div>
                )}
              </section>
            ) : null}

            {parameters.length > 0 ? (
              <section
                className="insert-control-section"
                aria-label="Device parameters"
              >
                <h3>Device parameters</h3>
                {parameters.map((parameter) => (
                  <label key={parameter.key} title={parameter.help}>
                    <span className="insert-parameter-name">
                      {parameter.label}
                      {parameter.unit ? ` / ${parameter.unit}` : ""}
                      <em>({parameter.help})</em>
                    </span>
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
                  </label>
                ))}
              </section>
            ) : null}
          </aside>

          <section
            className="insert-component-preview"
            aria-label="Component preview"
            aria-live="polite"
            tabIndex={0}
          >
            {selected ? (
              <>
                <SymbolArtwork
                  symbol={selected.symbol}
                  className="insert-symbol-artwork"
                  rotation={initialRotation}
                />
                <div>
                  <h3>{selected.cellName ?? selected.symbol.name}</h3>
                  <p>
                    {selected.kind === "cell" ? "Cell" : selected.symbol.id}
                  </p>
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
