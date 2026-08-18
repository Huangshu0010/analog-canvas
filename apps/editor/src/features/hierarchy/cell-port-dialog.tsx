import { useEffect, useId, useState } from "react";

import type { CellPortInsertRequest } from "../component-insert/component-insert-request";

export interface CellPortDialogProps {
  open: boolean;
  suggestedName: string;
  onApply(request: CellPortInsertRequest): void;
  onCancel(): void;
}

/** Declaration-only front end for the shared Port placement interaction. */
export function CellPortDialog({
  open,
  suggestedName,
  onApply,
  onCancel,
}: CellPortDialogProps) {
  const nameId = useId();
  const [name, setName] = useState(suggestedName);
  const [direction, setDirection] =
    useState<CellPortInsertRequest["direction"]>("passive");
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(suggestedName);
    setDirection("passive");
    setFilled(false);
  }, [open, suggestedName]);

  if (!open) return null;
  const formalName = name.trim();

  return (
    <div
      className="insert-dialog-backdrop"
      data-testid="cell-port-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="insert-component-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-port-dialog-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!formalName) return;
          onApply({
            kind: "cell-port",
            symbolId: filled ? "port-filled" : "port",
            symbolName: filled ? "Filled Cell Port" : "Cell Port",
            formalName,
            direction,
            initialRotation: 0,
          });
        }}
      >
        <header className="insert-dialog-header">
          <div>
            <p>Cell interface</p>
            <h2 id="cell-port-dialog-title">Add Cell Port</h2>
          </div>
        </header>
        <div className="insert-dialog-body">
          <section className="insert-control-column" aria-label="Cell Port">
            <label htmlFor={nameId}>
              <span>Port name</span>
              <input
                id={nameId}
                autoFocus
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Direction</span>
              <select
                aria-label="Cell Port direction"
                value={direction}
                onChange={(event) =>
                  setDirection(
                    event.currentTarget
                      .value as CellPortInsertRequest["direction"],
                  )
                }
              >
                <option value="input">Input</option>
                <option value="output">Output</option>
                <option value="inout">Inout</option>
                <option value="passive">Passive</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={filled}
                onChange={(event) => setFilled(event.currentTarget.checked)}
              />
              Filled marker
            </label>
            <p>
              Click an exact existing Net contact, or empty grid space to make a
              new local Net.
            </p>
          </section>
        </div>
        <footer className="insert-dialog-actions">
          <small>Then click to place · R rotates · Esc cancels</small>
          <div>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!formalName}>
              Place
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
