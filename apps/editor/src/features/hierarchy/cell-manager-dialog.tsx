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
  onCreate(name: string): void;
  onOpen(documentId: string): void;
  onRename(documentId: string, name: string): void;
  onDelete(documentId: string): void;
  onJumpToCaller(documentId: string, instanceId: string): void;
}) {
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const renameTarget = cells.find((cell) => cell.id === renameId);
  const deleteTarget = cells.find((cell) => cell.id === deleteId);
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
                <button
                  type="button"
                  onClick={() => {
                    setRenameId(cell.id);
                    setDraftName(cell.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={cell.isTop || cell.callers.length > 0}
                  onClick={() => setDeleteId(cell.id)}
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
          <button
            type="button"
            onClick={() => {
              setRenameId(null);
              setDraftName("");
              setDeleteId(null);
              setCreating(true);
            }}
          >
            New Cell
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
        {deleteTarget ? (
          <section
            className="cell-inline-dialog"
            role="dialog"
            aria-label="Delete Cell"
          >
            <h3>Delete {deleteTarget.name}?</h3>
            <p>This unreferenced Cell definition can be restored with Undo.</p>
            <button
              type="button"
              onClick={() => {
                onDelete(deleteTarget.id);
                setDeleteId(null);
              }}
            >
              Delete Cell
            </button>
            <button type="button" onClick={() => setDeleteId(null)}>
              Cancel
            </button>
          </section>
        ) : creating || renameTarget ? (
          <section
            className="cell-inline-dialog"
            role="dialog"
            aria-label={renameTarget ? "Rename Cell" : "New Cell"}
          >
            <h3>{renameTarget ? "Rename Cell" : "New Cell"}</h3>
            <input
              id="cell-name-input"
              aria-label="Cell name"
              value={draftName}
              onChange={(event) => setDraftName(event.currentTarget.value)}
            />
            <button
              type="button"
              onClick={() => {
                const name = draftName.trim();
                if (!name) return;
                if (renameTarget) onRename(renameTarget.id, name);
                else onCreate(name);
                setRenameId(null);
                setCreating(false);
                setDraftName("");
              }}
            >
              {" "}
              {renameTarget ? "Rename" : "Create"}{" "}
            </button>
            <button
              type="button"
              onClick={() => {
                setRenameId(null);
                setCreating(false);
                setDraftName("");
              }}
            >
              Cancel
            </button>
          </section>
        ) : null}
      </section>
    </div>
  );
}
import { useState } from "react";
