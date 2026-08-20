import { useEffect, useState } from "react";

import type {
  ExternalSubcircuitDefinition,
  SchematicDocument,
} from "@icm/model";

import { CellInterfaceEditor } from "./cell-interface-dialog";

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
  documents,
  activeDocumentId,
  onClose,
  onCreate,
  onOpen,
  onRename,
  onDelete,
  onJumpToCaller,
  onRenameTerminal,
  onSetTerminalDirection,
  onMoveTerminal,
  onSetFormalParameters,
  externalDefinitions,
  onSetExternalDefinition,
}: {
  open: boolean;
  cells: readonly CellManagerEntry[];
  documents: readonly SchematicDocument[];
  activeDocumentId: string;
  onClose(): void;
  onCreate(name: string): void;
  onOpen(documentId: string): void;
  onRename(documentId: string, name: string): void;
  onDelete(documentId: string): void;
  onJumpToCaller(documentId: string, instanceId: string): void;
  onRenameTerminal(documentId: string, terminalId: string, name: string): void;
  onSetTerminalDirection(
    documentId: string,
    terminalId: string,
    direction: "input" | "output" | "inout" | "passive",
  ): void;
  onMoveTerminal(documentId: string, terminalId: string, delta: -1 | 1): void;
  onSetFormalParameters(
    documentId: string,
    formalParameters: NonNullable<
      SchematicDocument["netlist"]
    >["formalParameters"],
  ): void;
  externalDefinitions: readonly ExternalSubcircuitDefinition[];
  onSetExternalDefinition(definition: ExternalSubcircuitDefinition): void;
}) {
  const [selectedId, setSelectedId] = useState(activeDocumentId);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId(activeDocumentId);
  }, [activeDocumentId, open]);

  const selectedEntry =
    cells.find((cell) => cell.id === selectedId) ?? cells[0];
  const selectedDocument = documents.find(
    (document) => document.id === selectedEntry?.id,
  );
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
        className="cell-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-manager-title"
      >
        <header className="cell-manager-header">
          <div>
            <p>Project hierarchy</p>
            <h2 id="cell-manager-title">Cell Manager</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Cell Manager"
          >
            Close
          </button>
        </header>

        <div className="cell-manager-body">
          <aside className="cell-manager-list" aria-label="Cells">
            <div className="cell-manager-list-heading">
              <span>Cells</span>
              <span>{cells.length}</span>
            </div>
            <div className="cell-manager-list-scroll">
              {cells.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  className="cell-manager-list-item"
                  aria-selected={cell.id === selectedEntry?.id}
                  onClick={() => setSelectedId(cell.id)}
                >
                  <span>
                    <strong>{cell.name}</strong>
                    {cell.isTop ? <em>Top</em> : null}
                  </span>
                  <small>
                    {cell.portCount} ports · {cell.callers.length} callers
                  </small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cell-manager-new"
              onClick={() => {
                setRenameId(null);
                setDraftName("");
                setDeleteId(null);
                setCreating(true);
              }}
            >
              New Cell
            </button>
          </aside>

          <div className="cell-manager-detail">
            {selectedEntry && selectedDocument ? (
              <>
                <header className="cell-manager-detail-header">
                  <div>
                    <div className="cell-manager-title-row">
                      <h3>{selectedEntry.name}</h3>
                      {selectedEntry.isTop ? <span>Top Cell</span> : null}
                    </div>
                    <p>
                      {selectedEntry.portCount} ports ·{" "}
                      {selectedEntry.callers.length} callers
                    </p>
                  </div>
                  <div className="cell-manager-actions">
                    <button
                      type="button"
                      onClick={() => onOpen(selectedEntry.id)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameId(selectedEntry.id);
                        setDraftName(selectedEntry.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={
                        selectedEntry.isTop || selectedEntry.callers.length > 0
                      }
                      onClick={() => setDeleteId(selectedEntry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </header>

                <CellInterfaceEditor
                  cell={selectedDocument}
                  callerCount={selectedEntry.callers.length}
                  onRenameTerminal={(terminalId, name) =>
                    onRenameTerminal(selectedEntry.id, terminalId, name)
                  }
                  onSetTerminalDirection={(terminalId, direction) =>
                    onSetTerminalDirection(
                      selectedEntry.id,
                      terminalId,
                      direction,
                    )
                  }
                  onMoveTerminal={(terminalId, delta) =>
                    onMoveTerminal(selectedEntry.id, terminalId, delta)
                  }
                  onSetFormalParameters={(formalParameters) =>
                    onSetFormalParameters(selectedEntry.id, formalParameters)
                  }
                  externalDefinitions={externalDefinitions}
                  onSetExternalDefinition={onSetExternalDefinition}
                />

                {selectedEntry.callers.length > 0 ? (
                  <details className="cell-manager-callers">
                    <summary>Callers ({selectedEntry.callers.length})</summary>
                    <ul>
                      {selectedEntry.callers.map((caller) => (
                        <li key={`${caller.documentId}:${caller.instanceId}`}>
                          <span>
                            {caller.documentName}.{caller.instanceId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onJumpToCaller(
                                caller.documentId,
                                caller.instanceId,
                              )
                            }
                          >
                            Jump to caller
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="cell-interface-empty">No Cell selected.</p>
            )}
          </div>
        </div>

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
              {renameTarget ? "Rename" : "Create"}
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
