import { useRef, useState } from "react";

import { DocumentHistory } from "@icm/edit-engine";
import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import { CircuitProjectSchema } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";

import {
  replaceProjectDocument,
  resolveActiveDocument,
} from "./editor-session";

type ProjectSymbolResolver = ReturnType<typeof createProjectSymbolResolver>;

export interface DocumentControllerSnapshot {
  project: CircuitProject;
  document: SchematicDocument;
  activeDocumentId: string;
  resolver: ProjectSymbolResolver;
  canUndo: boolean;
  canRedo: boolean;
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

  snapshot(): DocumentControllerSnapshot {
    return {
      project: this.project,
      document: this.document,
      activeDocumentId: this.activeDocumentId,
      resolver: this.resolver,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
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
    const result = this.historyValue.transact({
      transactionId: `transaction-ui-${this.transactionCounter}`,
      documentId: this.document.id,
      expectedRevision: this.historyValue.document.revision,
      actor: { kind: "human", id: "human-local" },
      edits: [...edits],
    });
    if (result.ok && result.applied) {
      this.projectValue = replaceProjectDocument(
        this.projectValue,
        result.document,
      );
      this.resolverValue = createProjectSymbolResolver(
        this.projectValue,
        builtInSymbols,
      );
    }
    return result;
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
  };
}
