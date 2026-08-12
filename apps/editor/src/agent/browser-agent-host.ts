import type {
  AgentHostTransactionRequest,
  AgentOperationHost,
} from "@icm/agent-adapter";
import {
  rejectTransaction,
  type EditTransactionResult,
} from "@icm/edit-engine";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { EditorDocumentController } from "../document/document-controller";

/**
 * Adapts a live {@link EditorDocumentController} to the
 * {@link AgentOperationHost} contract (ADR 0016 / WP-WA2). The Agent Circuit
 * service reads the current Project/resolver and dispatches Agent transactions
 * through the controller's single `dispatchTransaction` write path.
 *
 * `onTransactionCommitted` is invoked after a successful commit so the host
 * owner (the React hook in `App.tsx`) can synchronize UI state and stage
 * recovery — exactly as a human commit does.
 *
 * WP-WA3: this lets the full capabilities/snapshot/transact/render feature run
 * against the live browser document inside one process, with no network, token,
 * or Worker. The session transport is layered on top in WP-WA4/WP-WA5.
 */
export class BrowserAgentHost implements AgentOperationHost {
  private readonly boundProjectSessionId: string;

  constructor(
    private readonly controller: EditorDocumentController,
    private readonly onTransactionCommitted?: () => void,
  ) {
    this.boundProjectSessionId = controller.projectSessionId;
  }

  getDocument(documentId: string): SchematicDocument | null {
    if (this.controller.projectSessionId !== this.boundProjectSessionId) {
      return null;
    }
    const document = this.controller.project.documents.find(
      (candidate) => candidate.id === documentId,
    );
    return document ?? null;
  }

  getProject(): CircuitProject {
    this.assertBound();
    return this.controller.project;
  }

  getResolver(): SymbolResolver {
    this.assertBound();
    return this.controller.resolver;
  }

  dispatchTransaction(
    request: AgentHostTransactionRequest,
  ): EditTransactionResult {
    if (this.controller.projectSessionId !== this.boundProjectSessionId) {
      return rejectTransaction(
        this.controller.document,
        "DOCUMENT_MISMATCH",
        "The Agent session is bound to a Project that has been replaced",
      );
    }
    const result = this.controller.dispatchTransaction(request);
    if (result.ok && result.applied) {
      this.onTransactionCommitted?.();
    }
    return result;
  }

  private assertBound(): void {
    if (this.controller.projectSessionId !== this.boundProjectSessionId) {
      throw new Error("The Agent session Project has been replaced");
    }
  }
}
