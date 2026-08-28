import { useEffect, useState } from "react";

import type { CustomSymbolDefinition } from "@icm/model";

import { SymbolArtwork } from "../component-insert/symbol-artwork";
import type { SymbolDefinition } from "@icm/symbols";

export interface CustomSymbolManagerEntry {
  readonly definition: CustomSymbolDefinition;
  /** Runtime symbol, already re-keyed to the definition identity. */
  readonly symbol: SymbolDefinition;
  readonly usageCount: number;
}

export function CustomSymbolManagerDialog({
  open,
  entries,
  onClose,
  onRename,
  onRemove,
}: {
  open: boolean;
  entries: readonly CustomSymbolManagerEntry[];
  onClose(): void;
  onRename(definitionId: string, name: string): void;
  onRemove(definitionId: string): void;
}) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setRenameId(null);
    setDraftName("");
    setRemoveId(null);
  }, [open]);

  const renameTarget = entries.find(
    (entry) => entry.definition.id === renameId,
  );
  const removeTarget = entries.find(
    (entry) => entry.definition.id === removeId,
  );

  function dismissActionDialog(): void {
    setRenameId(null);
    setDraftName("");
    setRemoveId(null);
  }

  if (!open) return null;

  return (
    <div
      className="insert-dialog-backdrop"
      data-testid="custom-symbol-manager-backdrop"
      onPointerDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="custom-symbol-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-symbol-manager-title"
      >
        <header className="cell-manager-header">
          <div>
            <p>Project library</p>
            <h2 id="custom-symbol-manager-title">Custom Symbols</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Custom Symbols"
          >
            Close
          </button>
        </header>

        <div className="custom-symbol-manager-body">
          {entries.length === 0 ? (
            <p className="custom-symbol-manager-empty">
              No imported symbols yet. Use File → Import Symbol to add one.
            </p>
          ) : (
            <ul className="custom-symbol-manager-list">
              {entries.map((entry) => (
                <li
                  key={entry.definition.id}
                  className="custom-symbol-manager-item"
                  data-testid={`custom-symbol-entry-${entry.definition.id}`}
                >
                  <SymbolArtwork
                    symbol={entry.symbol}
                    className="custom-symbol-manager-art"
                    paddingRatio={0.04}
                  />
                  <div className="custom-symbol-manager-item-info">
                    <strong>{entry.symbol.name}</strong>
                    <small>
                      {entry.usageCount} placed · {entry.symbol.pins.length} pin
                      {entry.symbol.pins.length === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div className="custom-symbol-manager-item-actions">
                    <button
                      type="button"
                      data-testid={`custom-symbol-rename-${entry.definition.id}`}
                      onClick={() => {
                        setRemoveId(null);
                        setRenameId(entry.definition.id);
                        setDraftName(entry.symbol.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      data-testid={`custom-symbol-remove-${entry.definition.id}`}
                      disabled={entry.usageCount > 0}
                      title={
                        entry.usageCount > 0
                          ? `Still placed ${entry.usageCount} time${entry.usageCount === 1 ? "" : "s"} in this project`
                          : "Remove this imported symbol"
                      }
                      onClick={() => {
                        setRenameId(null);
                        setRemoveId(entry.definition.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {removeTarget || renameTarget ? (
          <div
            className="cell-manager-dialog-layer"
            onPointerDown={(event) =>
              event.target === event.currentTarget && dismissActionDialog()
            }
          >
            {removeTarget ? (
              <section
                className="editor-action-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Remove imported symbol"
                onKeyDown={(event) => {
                  if (event.key === "Escape") dismissActionDialog();
                }}
              >
                <header className="editor-action-dialog-header">
                  <p>Project library</p>
                  <h2>Remove {removeTarget.symbol.name}?</h2>
                </header>
                <div className="editor-action-dialog-body">
                  <p>
                    Remove this imported symbol from the project. You can
                    restore it with Undo.
                  </p>
                </div>
                <footer className="editor-action-dialog-actions">
                  <button type="button" autoFocus onClick={dismissActionDialog}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      onRemove(removeTarget.definition.id);
                      dismissActionDialog();
                    }}
                  >
                    Remove Symbol
                  </button>
                </footer>
              </section>
            ) : (
              <form
                className="editor-action-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="custom-symbol-rename-title"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!renameTarget) return;
                  const name = draftName.trim();
                  if (!name) return;
                  onRename(renameTarget.definition.id, name);
                  dismissActionDialog();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") dismissActionDialog();
                }}
              >
                <header className="editor-action-dialog-header">
                  <p>Project library</p>
                  <h2 id="custom-symbol-rename-title">Rename Symbol</h2>
                </header>
                <div className="editor-action-dialog-body">
                  <p>Update the display name. Placed instances keep working.</p>
                  <label className="editor-action-dialog-field">
                    <span>Symbol name</span>
                    <input
                      data-testid="custom-symbol-rename-input"
                      autoFocus
                      value={draftName}
                      onChange={(event) =>
                        setDraftName(event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
                <footer className="editor-action-dialog-actions">
                  <button type="button" onClick={dismissActionDialog}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={draftName.trim().length === 0}
                  >
                    Rename
                  </button>
                </footer>
              </form>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
