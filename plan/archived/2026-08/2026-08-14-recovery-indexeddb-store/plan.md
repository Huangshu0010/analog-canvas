---
status: completed
experience: none
---

# WP-1 - IndexedDB Recovery Store and Legacy Migration

## Goal

Implement the transactional browser storage adapter for the WP-0 recovery
contract: an application-specific IndexedDB database with atomic
rotation-plus-retention writes, scoped delete operations, the one-time
`icm.recovery.v1` localStorage migration, and typed quota/unavailable/failure
mapping.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean after WP-0 commit `5452004`.

Owned paths:

- `apps/editor/src/document/browser-recovery-store.ts` (new)
- `apps/editor/src/document/browser-recovery-store.test.ts` (new)
- `apps/editor/package.json` and `pnpm-lock.yaml` (new dev dependency
  `fake-indexeddb` for deterministic IndexedDB unit tests)
- this plan and `plan/log.md`

Read-only: `apps/editor/src/document/browser-recovery-contract.ts` (pure
rules, consumed as-is), `apps/editor/src/document/project-recovery.ts` (legacy
key import only), `packages/model`.

## Work

1. Open/upgrade an application-specific database (`analog-canvas-recovery`,
   version 1, one object store) with an injectable IDB factory; opening is
   idempotent and never touches other databases or stores.
2. `writeRecord`: one readwrite transaction that decodes existing records,
   rotates generations, applies retention deletes, and maps quota/abort/other
   errors to typed failures. An unchanged or oversized candidate performs no
   destructive operation.
3. `readAll` (with undecodable-record count), `deleteRecord`, `deleteSession`
   scoped to owned records only.
4. `migrateLegacyProjectRecovery`: read `icm.recovery.v1`, parse, write into a
   fresh working-copy session, and remove the legacy key only after the
   IndexedDB transaction commits; unmigratable data is retained with a typed
   reason.
5. Unit-test with `fake-indexeddb`: rotation/dedup/pruning through real
   transactions, put-failure rollback leaving prior records readable, foreign
   database survival, corrupt record isolation, upgrade idempotence, and all
   migration outcomes.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local apps/editor/src/document/browser-recovery-store.test.ts`
- `pnpm test:local apps/editor/src/document`
- `corepack pnpm typecheck`

## Commit Intent

Commit as:

```text
feat(editor): persist bounded browser recovery
```

## Outcome

Implemented `browser-recovery-store.ts`: an application-specific IndexedDB
database (`analog-canvas-recovery`, one object store) with an injectable IDB
factory, atomic single-transaction write (decode → rotate → retention deletes
before puts so a pruned slot cannot be resurrected or freshly written records
deleted), scoped `readAll`/`deleteRecord`/`deleteSession`, typed
quota/unavailable/failed mapping, and the one-time `icm.recovery.v1`
migration that removes the legacy key only after a committed IndexedDB write.
Added `fake-indexeddb` 6.2.5 as an editor dev dependency (lockfile change
re-verified with `pnpm install --frozen-lockfile`). Tests cover rotation and
dedup through real transactions, three-session pruning, oversized rejection,
put-failure rollback with prior records readable, foreign database/store
survival, undecodable-record isolation, idempotent reopen, scoped deletes, and
all six migration outcomes. Two defects were caught while building tests:
delete-after-put could remove a freshly written record sharing a rotated key,
and a retention-dropped previous generation could be re-written into its new
slot. Validation: 18 new tests (68 document tests total) green, `tsc` project
check clean, prettier clean, `git diff --check` clean.

status: completed
experience: none
