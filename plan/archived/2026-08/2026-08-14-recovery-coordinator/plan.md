---
status: completed
experience: none
---

# WP-2 - Recovery Coordinator and Project Lifecycle

## Goal

Replace the synchronous localStorage recovery hook with an IndexedDB-backed
coordinator: debounce-coalesced commits that never lose the newest revision,
typed pending/stored/failure state for React, working-copy forking at
replacement boundaries, preserved explicit-refresh exact restore, one-time
legacy migration, and removal of the old full-Project localStorage writer.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean after WP-1 commit `ee76c1e`.

Owned paths:

- `apps/editor/src/document/recovery-coordinator.ts` (new) and
  `recovery-coordinator.test.ts` (new)
- `apps/editor/src/document/project-recovery.ts` (remove the writer hook; keep
  the legacy key and storage interface for migration) and its test
- `apps/editor/src/app/App.tsx` (recovery wiring, replacement funnel,
  refresh/restore/discard/open handlers, File-menu recovery buttons)
- `apps/editor/e2e/manual-editor.spec.ts` and `component-insert.spec.ts`
  (recovery behaviors), `apps/editor/e2e/editor-fixtures.ts` (IndexedDB read
  helper)
- this plan and `plan/log.md`

Read-only: `browser-recovery-contract.ts`, `browser-recovery-store.ts`,
`recovery-scheduler.ts` (consumed as-is), `packages/model`, edit-engine,
document-controller commit contract (the `stage` callback shape is unchanged).

## Work

1. `createRecoveryCoordinator`: framework-free coordinator over the store —
   session identity persisted in sessionStorage, debounced staging via the
   existing scheduler, serialize/validate before enqueueing the IndexedDB
   write, a serial write chain so an in-flight write cannot lose a newer
   revision, typed state publication, working-copy forking, session summaries
   with valid/corrupt/unsupported-schema classification, scoped session read
   and delete.
2. `useRecoveryCoordinator` hook: React state mirror, mount-time legacy
   migration + non-blocking discovery, visibilitychange/pagehide flush,
   dispose on unmount; SSR-safe.
3. Rewire `App.tsx`: replacement funnel cancels pending writes, forks (or
   keeps) working-copy identity, and seeds the incoming Project; restore
   forks; explicit refresh awaits the flush before reloading and auto-restores
   the exact working copy; discard deletes the newest session; save/open no
   longer clear recovery; remove redundant post-replacement stage calls.
4. Delete the localStorage writer hook after migration coverage; keep
   `PROJECT_RECOVERY_KEY` and `ProjectRecoveryStorage`.
5. Unit tests on fake-indexeddb with injectable timers/storage; update the
   recovery E2E specs to the retained-recovery semantics with an IndexedDB
   read helper.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local apps/editor/src/document`
- `corepack pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "recovery"`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "refresh"`

## Commit Intent

Commit as:

```text
refactor(editor): coordinate durable working copies
```

## Outcome

Implemented `recovery-coordinator.ts` (framework-free
`createRecoveryCoordinator` + SSR-safe `useRecoveryCoordinator` hook):
sessionStorage-backed working-copy identity, scheduler-driven coalescing with
a serial write chain that cannot lose the newest revision while a write is in
flight, typed `pending`/`stored`/`unavailable`/`quota-exceeded`/`failed`
state, working-copy forking with pending-write cancellation, session
summaries with valid/corrupt/unsupported-schema classification, scoped
session read/delete, and mount-time legacy migration before non-blocking
discovery. App.tsx now routes every replacement through a source-tagged
funnel that cancels the outgoing pending write, forks (or, for an
explicit-refresh restore, keeps) the working copy, and seeds the incoming
Project; Save and Open no longer clear recovery; explicit Refresh awaits the
IndexedDB flush before reloading and auto-restores only the exact recorded
working copy. Removed the localStorage writer hook and its test
(`project-recovery.ts` keeps only the legacy key and storage interface).
17 new coordinator unit tests (fake-indexeddb + injectable timers/storage);
E2E updated to retained-recovery semantics with a direct IndexedDB read
helper — one expectation was corrected during the run because a replacement
inside the debounce window intentionally drops only the pending write.
Validation: 93 unit tests green; recovery/refresh/drafting/web-agent E2E
specs green; typecheck, prettier, `git diff --check` clean.

status: completed
experience: none
