---
status: completed
experience: none
---

# WP-WA3 — In-Browser Agent Host (no network)

## Goal

Run the complete Agent Circuit feature (capabilities/snapshot/transact/render)
against the live `EditorDocumentController` inside one browser process, with no
network, token, or Worker. The Agent service dispatches `transact` through the
controller's unified write path instead of `executeTransaction` + a private
commit.

## State and Ownership

Start state: clean `codex/web-agent-session-architecture` after WP-WA2 (`af5505c`).

Owned paths:

- `packages/agent-adapter/src/service.ts` (host-mode option + dispatch branch)
- `apps/editor/src/agent/browser-agent-host.ts` (new — `BrowserAgentHost`)
- `apps/editor/src/agent/browser-agent-host.test.ts` (new — integration tests)
- `apps/editor/package.json` + `pnpm-lock.yaml` (add `@icm/agent-adapter` dep)
- `plan/2026-08-12-web-agent-session-wa3/plan.md`, one `plan/log.md` entry

Read-only / shared:

- `packages/agent-adapter/src/host.ts` (`AgentOperationHost`, frozen in WP-WA2)
- `apps/editor/src/document/document-controller.ts` (`dispatchTransaction`)

## Work

1. Add `AgentCircuitHostServiceOptions` to the service and accept a union of
   store-mode and host-mode options. In host mode, read the resolver/Project and
   resolve the Document through the host at request time, and dispatch `transact`
   via `host.dispatchTransaction` (the host owns the commit; the service keeps its
   change-history ledger for the legacy `query changes` scope).
2. Implement `BrowserAgentHost` adapting the live controller to
   `AgentOperationHost`, with an `onTransactionCommitted` hook for UI sync.
3. Add `@icm/agent-adapter` as an editor dependency.
4. Integration-test all four operations against a live controller: capabilities,
   snapshot, transact (commit visible in controller state + one undo item +
   `onTransactionCommitted` fired), render (formal hash equals the direct
   renderer), stale revision, unknown document, and Project-replacement
   reflection.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm exec vitest run packages/agent-adapter apps/editor/src/document apps/editor/src/agent`
  (62 tests; store-mode parity preserved, host-mode integration green)
- `corepack pnpm typecheck`
- Prettier on changed files; lockfile re-resolved

## Commit Intent

```text
feat(agent): in-browser Agent host without network (WP-WA3)
```

## Outcome

Added host-mode to `createAgentCircuitService` (`AgentCircuitHostServiceOptions`):
the service resolves the Document/resolver/Project through the host at request
time and dispatches `transact` through `host.dispatchTransaction`, so no browser
Agent write calls `executeTransaction` or commits beside the controller/history.
Implemented `BrowserAgentHost` (live controller → `AgentOperationHost`) with a
commit hook for React synchronization.

Validation: 6 new integration tests prove capabilities/snapshot/transact/render
run against the live controller, an Agent commit is one undo item through the
shared history and fires the commit hook, the formal render sha256 equals the
direct renderer, stale revision is rejected with the current revision, an unknown
Document returns `DOCUMENT_NOT_FOUND`, and a replaced Project is reflected so the
old Document is unreachable. Store-mode parity preserved (29 adapter tests);
workspace `typecheck` clean; 62 focused tests pass.
