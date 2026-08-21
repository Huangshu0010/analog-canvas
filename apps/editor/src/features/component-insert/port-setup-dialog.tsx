import { useEffect, useState } from "react";

import type { ComponentInsertRequest } from "./component-insert-request";

type PortSymbolId = "port" | "port-filled";
type PortRole = "net-port" | "cell-terminal";
type PortDirection = "input" | "output" | "inout" | "passive";

function symbolName(symbolId: PortSymbolId): string {
  return symbolId === "port-filled" ? "Filled Port" : "Port";
}

export interface PortSetupDialogProps {
  readonly open: boolean;
  readonly symbolId: PortSymbolId;
  readonly allowFormalPort: boolean;
  onApply(request: ComponentInsertRequest): void;
  onCancel(): void;
}

/** Small semantic setup step before the shared canvas-placement interaction. */
export function PortSetupDialog({
  open,
  symbolId,
  allowFormalPort,
  onApply,
  onCancel,
}: PortSetupDialogProps) {
  const [role, setRole] = useState<PortRole>(() =>
    allowFormalPort ? "cell-terminal" : "net-port",
  );
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<PortDirection>("passive");
  const [error, setError] = useState<string | null>(null);
  const formalPort = role === "cell-terminal";

  useEffect(() => {
    if (!open) return;
    setRole(allowFormalPort ? "cell-terminal" : "net-port");
    setName("");
    setDirection("passive");
    setError(null);
  }, [allowFormalPort, open, symbolId]);

  if (!open) return null;

  const apply = (): void => {
    const trimmedName = name.trim();
    if (formalPort && trimmedName === "") {
      setError("A Formal Cell Pin needs a terminal name");
      return;
    }
    onApply({
      kind: "symbol",
      symbolId,
      symbolName: symbolName(symbolId),
      parameters: {},
      initialRotation: 0,
      showReference: false,
      referenceText: null,
      showValue: false,
      portRole: role,
      ...(trimmedName === "" ? {} : { portName: trimmedName }),
      portDirection: direction,
    });
  };

  return (
    <div
      className="port-setup-backdrop"
      data-testid="port-setup-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="port-setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="port-setup-title"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <header>
          <p>
            {formalPort ? "Define Cell interface" : "Place named connection"}
          </p>
          <h2 id="port-setup-title">
            {formalPort ? "Place Cell Pin" : "Place Net Port"}
          </h2>
        </header>

        <div className="port-setup-fields">
          {allowFormalPort ? (
            <fieldset>
              <legend>Port type</legend>
              <label>
                <input
                  type="radio"
                  name="port-role"
                  checked={role === "cell-terminal"}
                  onChange={() => setRole("cell-terminal")}
                />
                Formal Cell Pin
              </label>
              <label>
                <input
                  type="radio"
                  name="port-role"
                  checked={role === "net-port"}
                  onChange={() => setRole("net-port")}
                />
                Free Net Port
              </label>
            </fieldset>
          ) : null}
          <label>
            <span>{formalPort ? "Terminal name" : "Net name"}</span>
            <input
              autoFocus
              aria-label={formalPort ? "Terminal name" : "Net name"}
              value={name}
              placeholder={
                formalPort ? "Required" : "Optional — creates NET1, NET2…"
              }
              onChange={(event) => {
                setName(event.currentTarget.value);
                setError(null);
              }}
            />
          </label>
          {formalPort ? (
            <label>
              <span>Direction</span>
              <select
                aria-label="Cell Pin direction"
                value={direction}
                onChange={(event) =>
                  setDirection(event.currentTarget.value as PortDirection)
                }
              >
                <option value="input">Input</option>
                <option value="output">Output</option>
                <option value="inout">Inout</option>
                <option value="passive">Passive</option>
              </select>
            </label>
          ) : null}
          {error ? <p className="port-setup-error">{error}</p> : null}
        </div>

        <footer>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Place</button>
        </footer>
      </form>
    </div>
  );
}
