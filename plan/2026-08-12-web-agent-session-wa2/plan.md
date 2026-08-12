---
status: completed
experience: none
---

# WP-WA2 — Unified Editor Transaction Host

## Goal

Make `EditorDocumentController` accept a complete authenticated transaction
envelope (human or Agent actor) through one `dispatchTransaction()` path that
shares `DocumentHistory`, Project/resolver refresh, and undo, and freeze the
`AgentOperationHost` contract so WP-WA3 can wire the Agent service to the live
editor without a second mutation engine.

## State and Ownership

Start state: clean `codex/web-agent-session-architecture` after WP-WA1 (`37de84e`).

Verified facts driving the design:

- `EditActor = { kind: "human" | "agent"; id: string }` (id required),
  `EditTransaction`, and `EditTransactionResult` are exported by `@icm/edit-engine`;
  `rejectTransaction` is exported too.
- `DocumentHistory.transact(input)` is the single history mutation boundary and
  already accepts the full envelope including actor.
- The current `EditorDocumentController.transact(edits)` hard-codes
  `{ kind: "human", id: "human-local" }` and `transaction-ui-N`; it refreshes
  Project + resolver only on `result.applied`.
- `apps/editor/src/document/document-controller.test.ts` covers commit, per-Document
  undo histories, missing-document rejection, and Project-replacement reset.

Owned paths:

- `packages/agent-adapter/src/host.ts` (new — frozen `AgentOperationHost` contract)
- `packages/agent-adapter/src/index.ts` (re-export host)
- `apps/editor/src/document/document-controller.ts` (`dispatchTransaction` + refactor)
- `apps/editor/src/document/document-controller.test.ts` (extend with dispatch tests)
- `plan/2026-08-12-web-agent-session-wa2/plan.md`, one `plan/log.md` entry

Read-only / shared:

- `packages/edit-engine/src/{transaction,history}.ts` (consumed unchanged)
- `packages/agent-adapter/src/service.ts` (re-pointed to the host in WP-WA3)
- `apps/editor/src/document/editor-session.ts` (`replaceProjectDocument`,
  `resolveActiveDocument`)

## Work

1. Add `host.ts`: `AgentHostTransactionRequest` (agent actor only) and
   `AgentOperationHost` (`getDocument`, `getProject?`, `getResolver`,
   `dispatchTransaction`) — the frozen contract the Agent service consumes.
2. Add `EditorDocumentController.dispatchTransaction({transactionId, documentId,
   expectedRevision, actor, dryRun, edits})`: select the matching per-Document
   history (or return a typed `OBJECT_NOT_FOUND` rejection), call
   `DocumentHistory.transact`, and on `applied` replace the Project document and
   refresh the resolver — identical to a human commit. `dryRun` changes nothing.
3. Refactor `transact(edits)` to delegate to `dispatchTransaction` with the human
   actor, preserving all current behavior.
4. Expose `dispatchTransaction` on `useDocumentController` with the same
   post-commit React synchronization and `onCommittedProject` callback as
   `transact`.
5. Extend the controller tests: human-via-dispatch parity, Agent commit is one
   undo item, dry-run no-op, stale revision, dispatch to a non-active Document
   updates only that Document, resolver refresh after an Agent geometry edit, and
   Project-replacement invalidation baseline.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm exec vitest run apps/editor/src/document` (controller + session +
  recovery tests)
- `corepack pnpm typecheck`
- Prettier on changed files

Rationale: the change is the editor mutation boundary plus a shared contract; the
document-controller test suite plus workspace typecheck is the smallest
deterministic cover. No Agent host consumes the contract until WP-WA3.

## Commit Intent

```text
feat(editor): unify human/Agent transaction dispatch (WP-WA2)
```

## Outcome

Added `EditorDocumentController.dispatchTransaction(EditorTransactionRequest)` as
the single write path for human and Agent transactions: it selects the matching
per-Document history (or returns a typed `OBJECT_NOT_FOUND` rejection) without
retargeting the active Document, dispatches through `DocumentHistory.transact`,
and on a successful commit replaces the Project document and refreshes the
resolver exactly like a human commit. `dryRun` mutates nothing. Refactored
`transact(edits)` to delegate to it, preserving all prior behavior, and exposed
`dispatchTransaction` on `useDocumentController` with the same React
synchronization and `onCommittedProject` callback.

Froze the `AgentOperationHost` contract (`getDocument`/`getProject`/`getResolver`/
`dispatchTransaction`) in `packages/agent-adapter/src/host.ts` for WP-WA3 to
implement against the live controller.

Validation: extended the controller suite to 11 tests covering Agent-commit =
one undo item, resolver refresh, human-via-dispatch parity, dry-run no-op,
stale-revision rejection, dispatch to a non-active Document, and missing-Document
rejection; 27 document tests pass; workspace `typecheck` clean.
