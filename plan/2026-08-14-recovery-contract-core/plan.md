---
status: active
experience: none
---

# WP-0 - Recovery Contract and Deterministic Retention Core

## Goal

Freeze the browser-recovery record contract as executable pure functions:
envelope decode, byte accounting, generation rotation, deduplication, session
and total-cap retention, and typed classification of corrupt versus
unsupported-schema records. Update the persistence spec and user compatibility
statements to the v2 contract before any GUI or storage change.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean worktree on the dedicated review branch created from main `f36bc76` for
the coordination plan `plan/2026-08-14-robust-page-persistence-recovery/`.

Owned paths:

- `apps/editor/src/document/browser-recovery-contract.ts` (new)
- `apps/editor/src/document/browser-recovery-contract.test.ts` (new)
- `docs/specs/persistence-and-recovery.md`
- `docs/user/project-compatibility.md`
- this plan and `plan/log.md`

Read-only: `packages/model` (parse/serialize/schema constants are imported,
not modified), `apps/editor/src/app/App.tsx`, all existing recovery code.

## Work

1. Define `BrowserRecoveryRecordV2` constants (format tag, 2 sessions, 4 MB per
   record, 12 MB total) and the record/generation/session types from the
   coordination plan.
2. Implement structural envelope decode that recomputes UTF-8 byte length and
   rejects malformed input as typed `corrupt`.
3. Implement project review: parse `projectText`, distinguish
   `unsupported-schema` (raw text preserved) from `corrupt`, and require
   envelope/project agreement.
4. Implement generation rotation with identical-text deduplication and a
   rejected-too-large path that returns the unchanged session.
5. Implement deterministic retention planning: active session always kept, at
   most two sessions by recency, then oldest inactive session first, then
   `previous` generations for the 12 MB total cap.
6. Update the persistence spec and user compatibility statements.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local apps/editor/src/document/browser-recovery-contract.test.ts`
- `pnpm test:local apps/editor/src/document` (contract must not disturb the
  existing document unit contracts)

## Commit Intent

Commit as:

```text
feat(editor): define bounded recovery records
```

## Outcome

Implemented `browser-recovery-contract.ts` with executable limits (format tag,
2 sessions, 4 MB per record, 12 MB total), structural envelope decode that
recomputes UTF-8 byte length, project review classifying
valid/corrupt/unsupported-schema with raw-text preservation, generation
rotation with identical-text deduplication and rejected-too-large protection,
and deterministic retention planning (active session always kept, oldest
inactive session pruned first, inactive `previous` generations dropped before
the active one for the total cap). Two retention bugs were caught by tests
(active-session eviction guard and absent-active quota) and fixed before
commit. Updated `docs/specs/persistence-and-recovery.md` and the user
compatibility statement. Validation: 23 new contract tests plus all 27
existing document unit tests green (50 total), prettier clean on changed
files, `tsc` project check clean, `git diff --check` clean.

status: completed
experience: none
