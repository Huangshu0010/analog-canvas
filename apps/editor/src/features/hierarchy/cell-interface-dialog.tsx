import type {
  CellNetlistTerminal,
  CellSymbolPinPlacement,
  CellSymbolSide,
} from "@icm/model";

export interface CellInterfaceDialogProps {
  open: boolean;
  cellName: string;
  terminals: readonly CellNetlistTerminal[];
  pinPlacements: readonly CellSymbolPinPlacement[];
  canExposeSelectedPort: boolean;
  hasSelectedFormalPort: boolean;
  onClose(): void;
  onAddPort(): void;
  onExposePort(): void;
  onRenamePort(): void;
  onDeletePort(): void;
  onDirectionChange(
    terminalId: string,
    direction: CellNetlistTerminal["direction"],
  ): void;
  onPlacementChange(
    terminalId: string,
    side: "auto" | CellSymbolSide,
    offset: number,
  ): void;
  onReorder(terminalId: string, delta: -1 | 1): void;
}

/** Focused editor for the reusable symbol interface of a non-root Cell. */
export function CellInterfaceDialog({
  open,
  cellName,
  terminals,
  pinPlacements,
  canExposeSelectedPort,
  hasSelectedFormalPort,
  onClose,
  onAddPort,
  onExposePort,
  onRenamePort,
  onDeletePort,
  onDirectionChange,
  onPlacementChange,
  onReorder,
}: CellInterfaceDialogProps) {
  if (!open) return null;

  return (
    <div
      className="insert-dialog-backdrop"
      data-testid="cell-interface-dialog-backdrop"
      onPointerDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="insert-component-dialog cell-interface-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-interface-dialog-title"
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <header className="insert-dialog-header">
          <div>
            <p>Reusable symbol</p>
            <h2 id="cell-interface-dialog-title">
              Cell Interface — {cellName}
            </h2>
          </div>
        </header>
        <div className="cell-interface-body">
          {terminals.length === 0 ? (
            <p className="cell-interface-empty">
              This Cell has no formal ports. Add a port, or select a connected
              Port instance on the canvas and expose it.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Direction</th>
                  <th>Side</th>
                  <th>Offset</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {terminals.map((terminal, index) => {
                  const placement = pinPlacements.find(
                    (candidate) => candidate.terminalId === terminal.id,
                  );
                  const side = placement?.side ?? "auto";
                  return (
                    <tr key={terminal.id}>
                      <td>{terminal.name}</td>
                      <td>
                        <select
                          aria-label={`${terminal.name} direction`}
                          value={terminal.direction}
                          onChange={(event) =>
                            onDirectionChange(
                              terminal.id,
                              event.currentTarget
                                .value as CellNetlistTerminal["direction"],
                            )
                          }
                        >
                          <option value="input">Input</option>
                          <option value="output">Output</option>
                          <option value="inout">Inout</option>
                          <option value="passive">Passive</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`${terminal.name} side`}
                          value={side}
                          onChange={(event) =>
                            onPlacementChange(
                              terminal.id,
                              event.currentTarget.value as
                                "auto" | CellSymbolSide,
                              placement?.offset ?? 0,
                            )
                          }
                        >
                          <option value="auto">Auto</option>
                          <option value="west">West</option>
                          <option value="east">East</option>
                          <option value="north">North</option>
                          <option value="south">South</option>
                        </select>
                      </td>
                      <td>
                        <input
                          key={`${terminal.id}:${side}:${placement?.offset ?? 0}`}
                          aria-label={`${terminal.name} offset`}
                          type="number"
                          step="10"
                          defaultValue={placement?.offset ?? 0}
                          disabled={side === "auto"}
                          onBlur={(event) =>
                            onPlacementChange(
                              terminal.id,
                              side,
                              Number(event.currentTarget.value),
                            )
                          }
                        />
                      </td>
                      <td className="cell-interface-order">
                        <button
                          type="button"
                          aria-label={`Move ${terminal.name} earlier`}
                          disabled={index === 0}
                          onClick={() => onReorder(terminal.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${terminal.name} later`}
                          disabled={index === terminals.length - 1}
                          onClick={() => onReorder(terminal.id, 1)}
                        >
                          ↓
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <footer className="insert-dialog-actions cell-interface-actions">
          <div>
            <button type="button" onClick={onAddPort}>
              Add Port
            </button>
            <button
              type="button"
              disabled={!canExposeSelectedPort}
              onClick={onExposePort}
              title="Select a connected Port instance on the canvas first"
            >
              Expose Selected
            </button>
            <button
              type="button"
              disabled={!hasSelectedFormalPort}
              onClick={onRenamePort}
            >
              Rename Selected
            </button>
            <button
              type="button"
              disabled={!hasSelectedFormalPort}
              onClick={onDeletePort}
            >
              Delete Selected
            </button>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
