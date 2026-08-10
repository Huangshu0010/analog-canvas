# Project Recovery Lifecycle

## Goal

Move crash-recovery persistence and browser lifecycle ownership out of App.
Provide one typed recovery contract for candidate loading, corrupt-data cleanup,
coalesced Project writes, page-hide flushing, project-swap cancellation, and
stored recovery clearing.

## Dirty-State Decision

The three editor architecture targets through `b549488` are committed. The
remaining dirty documentation, archive, spec, reference, shared log, and
documentation-cleanup plan are independently owned and remain read-only.

## Owned Files

- `apps/editor/src/App.tsx`: recovery initialization/effects/helpers and their
  command call sites only
- `apps/editor/src/project-recovery.ts`
- `apps/editor/src/project-recovery.test.ts`
- `apps/editor/src/recovery-scheduler.ts`: type the existing scheduler generic
  without changing scheduling behavior
- `apps/editor/src/recovery-scheduler.test.ts`: compile/runtime regression only
- `plan/2026-08-10-project-recovery/plan.md`

## Read-Only Files

- Existing unrelated dirty paths and `plan/log.md`
- Document controller and its tests
- Model, edit-engine, renderer, derived, symbol, and exporter packages

## Shared Dependencies

- Recovery stores a complete serialized `CircuitProject` under
  `icm.recovery.v1`; it is not a backend or permanent user account store.
- Latest scheduled Project wins, page hide flushes, React unmount cancels, and
  whole-project replacement cancels pending writes.
- Corrupt recovery is removed and reported; valid recovery remains opt-in via
  Restore/Discard commands.
- Save/Open/Discard consume and clear stored recovery; SPICE import stages the
  imported complete Project.
- Server-side/static rendering must not access browser globals during render.

## Expected Work

1. Make `RecoveryScheduler` generic so Project recovery no longer casts from
   `unknown` at every boundary.
2. Add pure recovery loading/clearing operations with storage injection and
   deterministic tests.
3. Add a browser-safe React hook owning scheduler creation, recovery candidate,
   lifecycle listeners, and semantic commands.
4. Migrate App to `stage`, `cancelPending`, `clearStored`, and
   `consumeCandidate` without direct localStorage or lifecycle listeners.

## Validation

- Recovery scheduler and project recovery unit tests
- App static-render tests to prove browser globals remain effect-only
- Focused automatic recovery, save/open, discard, import, and project
  replacement Playwright paths
- Full editor Vitest and Playwright suites
- `pnpm typecheck`, editor build, `git diff --check`, final status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): isolate project recovery lifecycle
```

Shared `plan/log.md` remains deferred to its concurrent owner.

## Outcome

- Made the existing coalescing scheduler generic, removing the `unknown` cast
  at the Project persistence boundary without changing timer behavior.
- Added pure, storage-injected recovery loading and clearing functions. Missing,
  valid, and corrupt slots now have an explicit discriminated result contract.
- Added a browser-safe hook that owns the typed scheduler, candidate state,
  serialization, visibility/pagehide flushing, unmount disposal, pending-write
  cancellation, stored-data clearing, and candidate consumption.
- Removed App's recovery constants, scheduler/state construction, direct
  localStorage access, two lifecycle effects, and three thin helper functions.
  App now uses only recovery-domain commands.
- Reduced `App.tsx` from 6,961 to 6,901 lines while preserving the complete
  Project recovery format and all user-visible Restore/Discard behavior.

Validation completed on 2026-08-10:

- `pnpm typecheck`
- focused recovery scheduler, Project recovery, and App Vitest — 24 tests
  passed
- focused save/open/import/recovery Playwright — 5 tests passed
- full `pnpm exec vitest run apps/editor/src` — 17 files, 66 tests passed
- full `pnpm exec playwright test` — 59 tests passed
- `pnpm --filter @icm/editor... build`
- `git diff --check`

The unrelated dirty documentation target and shared `plan/log.md` were not
edited. Browser infrastructure ownership is now separated from document state;
the next target should split the geometry-heavy route or drafting canvas
controller from App.
