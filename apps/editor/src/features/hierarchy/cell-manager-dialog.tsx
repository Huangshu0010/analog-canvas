export interface CellManagerEntry {
  readonly id: string;
  readonly name: string;
  readonly isTop: boolean;
  readonly portCount: number;
  readonly callers: readonly {
    documentId: string;
    documentName: string;
    instanceId: string;
  }[];
}

export function CellManagerDialog({
  open,
  cells,
  onClose,
  onCreate,
  onOpen,
  onRename,
  onDelete,
  onJumpToCaller,
}: {
  open: boolean;
  cells: readonly CellManagerEntry[];
  onClose(): void;
  onCreate(): void;
  onOpen(documentId: string): void;
  onRename(documentId: string): void;
  onDelete(documentId: string): void;
  onJumpToCaller(documentId: string, instanceId: string): void;
}) {
  if (!open) return null;
  return (
    <div
      className="insert-dialog-backdrop"
      onPointerDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="insert-component-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-manager-title"
      >
        <header className="insert-dialog-header">
          <div>
            <p>Project hierarchy</p>
            <h2 id="cell-manager-title">Cell Manager</h2>
          </div>
        </header>
        <div className="insert-dialog-body">
          <section className="insert-control-column" aria-label="Cells">
            {cells.map((cell) => (
              <article key={cell.id} className="cell-manager-entry">
                <h3>
                  {cell.name}
                  {cell.isTop ? " (top)" : ""}
                </h3>
                <p>
                  {cell.portCount} ports · {cell.callers.length} callers
                </p>
                <button type="button" onClick={() => onOpen(cell.id)}>
                  Open
                </button>
                <button type="button" onClick={() => onRename(cell.id)}>
                  Rename
                </button>
                <button
                  type="button"
                  disabled={cell.isTop || cell.callers.length > 0}
                  onClick={() => onDelete(cell.id)}
                >
                  Delete
                </button>
                {cell.callers.length > 0 ? (
                  <ul>
                    {cell.callers.map((caller) => (
                      <li key={`${caller.documentId}:${caller.instanceId}`}>
                        {caller.documentName}.{caller.instanceId}{" "}
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToCaller(caller.documentId, caller.instanceId)
                          }
                        >
                          Jump to caller
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        </div>
        <footer className="insert-dialog-actions">
          <button type="button" onClick={onCreate}>
            New Cell
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
