import { useRef, useState } from "react";

import { DocumentHistory, rejectTransaction } from "@icm/edit-engine";
import type {
  EditActor,
  EditTransactionResult,
  SchematicEdit,
} from "@icm/edit-engine";
import { CircuitProjectSchema } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";

import {
  replaceProjectDocument,
  resolveActiveDocument,
} from "./editor-session";

type ProjectSymbolResolver = ReturnType<typeof createProjectSymbolResolver>;

/**
 * A complete authenticated transaction envelope accepted by
 * {@link EditorDocumentController.dispatchTransaction}. Both human and Agent
 * entry points build one of these; the actor identifies the origin. This is the
 * single write envelope that reaches `DocumentHistory`.
 */
export interface EditorTransactionRequest {
  transactionId: string;
  documentId: string;
  expectedRevision: number;
  actor: EditActor;
  dryRun?: boolean;
  edits: readonly SchematicEdit[];
}

export interface DocumentControllerSnapshot {
  project: CircuitProject;
  document: SchematicDocument;
  activeDocumentId: string;
  resolver: ProjectSymbolResolver;
  canUndo: boolean;
  canRedo: boolean;
  projectSessionId: string;
}

/**
 * Owns the editor's one mutable document-history graph. React receives only
 * immutable snapshots; all committed model changes still pass through
 * DocumentHistory and the validated Project replacement helper.
 */
export class EditorDocumentController {
  private projectValue: CircuitProject;
  private activeDocumentIdValue: string;
  private resolverValue: ProjectSymbolResolver;
  private historyValue: DocumentHistory;
  private histories: Map<string, DocumentHistory>;
  private transactionCounter = 0;
  private projectSessionCounter = 1;

  constructor(initialProject: CircuitProject) {
    this.projectValue = CircuitProjectSchema.parse(
      structuredClone(initialProject),
    );
    this.activeDocumentIdValue = this.projectValue.topDocumentId;
    this.resolverValue = createProjectSymbolResolver(
      this.projectValue,
      builtInSymbols,
    );
    const document = resolveActiveDocument(
      this.projectValue,
      this.activeDocumentIdValue,
    );
    this.historyValue = new DocumentHistory(document, {
      symbolResolver: this.resolverValue,
    });
    this.histories = new Map([[document.id, this.historyValue]]);
  }

  get project(): CircuitProject {
    return this.projectValue;
  }

  get document(): SchematicDocument {
    return resolveActiveDocument(this.projectValue, this.activeDocumentIdValue);
  }

  get activeDocumentId(): string {
    return this.activeDocumentIdValue;
  }

  get resolver(): ProjectSymbolResolver {
    return this.resolverValue;
  }

  get canUndo(): boolean {
    return this.historyValue.canUndo;
  }

  get canRedo(): boolean {
    return this.historyValue.canRedo;
  }

  get transactionsIssued(): number {
    return this.transactionCounter;
  }

  get projectSessionId(): string {
    return `${this.projectValue.id}:${this.projectSessionCounter}`;
  }

  snapshot(): DocumentControllerSnapshot {
    return {
      project: this.project,
      document: this.document,
      activeDocumentId: this.activeDocumentId,
      resolver: this.resolver,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      projectSessionId: this.projectSessionId,
    };
  }

  openDocument(documentId: string): SchematicDocument | null {
    if (documentId === this.activeDocumentIdValue) return this.document;
    const document = this.projectValue.documents.find(
      (candidate) => candidate.id === documentId,
    );
    if (!document) return null;

    const existingHistory = this.histories.get(document.id);
    this.historyValue =
      existingHistory?.document.revision === document.revision
        ? existingHistory
        : new DocumentHistory(document, {
            symbolResolver: this.resolverValue,
          });
    this.histories.set(document.id, this.historyValue);
    this.activeDocumentIdValue = document.id;
    return document;
  }

  replaceProject(nextProject: CircuitProject): SchematicDocument {
    this.projectSessionCounter += 1;
    this.projectValue = CircuitProjectSchema.parse(
      structuredClone(nextProject),
    );
    this.activeDocumentIdValue = this.projectValue.topDocumentId;
    this.resolverValue = createProjectSymbolResolver(
      this.projectValue,
      builtInSymbols,
    );
    const document = this.document;
    this.historyValue = new DocumentHistory(document, {
      symbolResolver: this.resolverValue,
    });
    this.histories = new Map([[document.id, this.historyValue]]);
    return document;
  }

  transact(edits: readonly SchematicEdit[]): EditTransactionResult {
    this.transactionCounter += 1;
    return this.dispatchTransaction({
      transactionId: `transaction-ui-${this.transactionCounter}`,
      documentId: this.activeDocumentIdValue,
      expectedRevision: this.historyValue.document.revision,
      actor: { kind: "human", id: "human-local" },
      edits,
    });
  }

  /**
   * The single write path for both human and Agent transactions. Selects the
   * matching per-Document history (without retargeting the active Document),
   * dispatches through {@link DocumentHistory.transact}, and on a successful
   * commit replaces the Project document and refreshes the resolver exactly like
   * a human commit. `dryRun` mutates no history, Project, resolver, or undo
   * state. Opening or viewing another Document neither retargets nor cancels an
   * explicit dispatch.
   *
   * Unexpected runtime exceptions from the engine or from post-commit Project
   * re-validation are converted into typed `INTERNAL_ERROR` rejections: the
   * Project and revision keep their previous values and the histories are
   * rebuilt from that unchanged Project, so a later transaction continues from
   * a consistent state.
   */
  dispatchTransaction(
    request: EditorTransactionRequest,
  ): EditTransactionResult {
    const history = this.historyForDocument(request.documentId);
    if (!history) {
      return rejectTransaction(
        this.document,
        "OBJECT_NOT_FOUND",
        `Document ${request.documentId} is not present in the Project`,
      );
    }
    let result: EditTransactionResult;
    try {
      result = history.transact(request);
    } catch (error) {
      this.resetHistoriesFromProject();
      return rejectTransaction(
        this.document,
        "INTERNAL_ERROR",
        `Transaction failed with an internal error: ${
          error instanceof Error ? error.message : "unknown failure"
        }`,
      );
    }
    if (result.ok && result.applied) {
      const previousProject = this.projectValue;
      try {
        this.projectValue = replaceProjectDocument(
          this.projectValue,
          result.document,
        );
        this.resolverValue = createProjectSymbolResolver(
          this.projectValue,
          builtInSymbols,
        );
      } catch (error) {
        this.projectValue = previousProject;
        this.resetHistoriesFromProject();
        return rejectTransaction(
          this.document,
          "INTERNAL_ERROR",
          `Committed document could not be re-validated into a Project: ${
            error instanceof Error ? error.message : "unknown failure"
          }`,
        );
      }
    }
    return result;
  }

  /**
   * Rebuild every history from the current (unchanged) Project after an
   * internal error. The undo history is deliberately sacrificed here: the
   * histories may hold a partially applied document, and model consistency
   * outranks undo depth on this rare path.
   */
  private resetHistoriesFromProject(): void {
    const document = this.document;
    this.historyValue = new DocumentHistory(document, {
      symbolResolver: this.resolverValue,
    });
    this.histories = new Map([[document.id, this.historyValue]]);
  }

  /**
   * Returns the per-Document history for `documentId`, creating one at the
   * Project's current revision if the Document has never been opened. Returns
   * `null` when the Document is absent so the caller can produce a typed error.
   * Never changes the active Document.
   */
  private historyForDocument(documentId: string): DocumentHistory | null {
    const existing = this.histories.get(documentId);
    if (existing) return existing;
    const document = this.projectValue.documents.find(
      (candidate) => candidate.id === documentId,
    );
    if (!document) return null;
    const history = new DocumentHistory(document, {
      symbolResolver: this.resolverValue,
    });
    this.histories.set(documentId, history);
    return history;
  }
}

export function useDocumentController(
  initialProject: CircuitProject,
  onCommittedProject: (project: CircuitProject) => void,
) {
  const controllerRef = useRef<EditorDocumentController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new EditorDocumentController(initialProject);
  }
  const controller = controllerRef.current;
  const onCommittedRef = useRef(onCommittedProject);
  onCommittedRef.current = onCommittedProject;
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());
  const synchronize = () => setSnapshot(controller.snapshot());

  return {
    ...snapshot,
    controller,
    openDocument: (documentId: string) => {
      const document = controller.openDocument(documentId);
      if (document) synchronize();
      return document;
    },
    replaceProject: (project: CircuitProject) => {
      const document = controller.replaceProject(project);
      synchronize();
      return document;
    },
    transact: (edits: readonly SchematicEdit[]) => {
      const result = controller.transact(edits);
      if (result.ok && result.applied) {
        synchronize();
        onCommittedRef.current(controller.project);
      }
      return result;
    },
    dispatchTransaction: (request: EditorTransactionRequest) => {
      const result = controller.dispatchTransaction(request);
      if (result.ok && result.applied) {
        synchronize();
        onCommittedRef.current(controller.project);
      }
      return result;
    },
    synchronizeExternalCommit: () => {
      synchronize();
      onCommittedRef.current(controller.project);
    },
  };
}
