/**
 * Frozen Agent operation host contract (WP-WA2). The in-browser Agent Host
 * (WP-WA3) implements this against the live `EditorDocumentController`, and the
 * Agent Circuit service dispatches `transact` through `dispatchTransaction`
 * instead of invoking the Edit Engine + a private commit path independently.
 *
 * Contract source: [`docs/specs/web-agent-session.md`](../../../docs/specs/web-agent-session.md)
 * "Browser host dispatch contract".
 */

import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import type { CircuitProject, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

/** An Agent transaction submitted to the host. The actor is always an Agent. */
export interface AgentHostTransactionRequest {
  transactionId: string;
  documentId: string;
  expectedRevision: number;
  actor: { kind: "agent"; id: string };
  dryRun?: boolean;
  edits: readonly SchematicEdit[];
}

/**
 * What an Agent operation host exposes to the Agent Circuit service. `getDocument`
 * resolves a Document id to the live `SchematicDocument`; `getResolver`/`getProject`
 * supply the current resolver/Project at request time, never stale
 * construction-time state. `dispatchTransaction` is the only write path.
 */
export interface AgentOperationHost {
  getDocument(documentId: string): SchematicDocument | null;
  getProject?(): CircuitProject;
  getResolver(): SymbolResolver;
  dispatchTransaction(
    request: AgentHostTransactionRequest,
  ): EditTransactionResult;
}
