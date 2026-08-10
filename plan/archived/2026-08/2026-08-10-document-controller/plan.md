# Editor Document Controller

## Goal

Establish one owner for the active Project, Document, symbol resolver,
per-document undo/redo histories, and transaction sequence. App should issue
typed edits and react to results without directly synchronizing those pieces.

## Dirty-State Decision

Editor architecture commits `06a97b0` and `bf2bdcb` are complete. Remaining
dirty documentation, archive, spec, reference, shared log, and the untracked
documentation-cleanup plan belong to another target. They are unrelated and
remain read-only.

## Owned Files

- `apps/editor/src/App.tsx`: project/history initialization, document switching,
  project replacement, transaction wrapper, and undo/redo capability reads
  only
- `apps/editor/src/document-controller.ts`
- `apps/editor/src/document-controller.test.ts`
- `plan/2026-08-10-document-controller/plan.md`

## Read-Only Files

- Existing dirty documentation and `plan/log.md`
- `apps/editor/src/editor-session.ts`: consume its validated pure helpers
- Recovery scheduler implementation and tests
- Model, edit-engine, symbol, renderer, derived, and exporter packages

## Shared Dependencies

- `DocumentHistory.transact` remains the only edit mutation boundary.
- Each document retains an independent undo/redo history and stale histories
  are rebuilt when their revision no longer matches the Project document.
- Applied results replace exactly one validated Project document.
- Whole-project replacement resets all histories and returns to the top
  document; recovery cancellation remains an App lifecycle concern.
- The controller notifies App only after an applied transaction so recovery can
  schedule the resulting complete Project.

## Expected Work

1. Implement a testable document controller owning validated project state,
   active document, resolver, histories, and transaction IDs.
2. Provide a React hook snapshot with open-document, replace-project, transact,
   and undo/redo capability commands.
3. Migrate App off direct project state, active-document state, history refs,
   resolver construction, and project patching.
4. Prove independent history restoration, stale-history rebuild, project
   replacement, transaction sequencing, and applied-project notification.

## Validation

- Focused document-controller and editor-session unit tests
- Existing App tests
- Focused hierarchy, undo/redo, recovery, project replacement, import, and demo
  Playwright paths
- Full editor Vitest and Playwright suites
- `pnpm typecheck`, editor production build, `git diff --check`, status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): isolate document transaction controller
```

Shared `plan/log.md` remains deferred to its current owner.

## Outcome

- Added a testable controller that exclusively owns validated Project state,
  active Document identity, the project symbol resolver, per-document
  `DocumentHistory` instances, undo/redo capabilities, and UI transaction IDs.
- Added a React snapshot hook exposing only `openDocument`, `replaceProject`,
  and `transact` mutations. Applied transactions notify App with the complete
  next Project for coalesced recovery scheduling.
- Removed App's Project and active-document state setters, resolver memo,
  current-history ref, history map, direct Project patching, and transaction-ID
  construction.
- Separated the pre-existing UI object/deletion suffix counter from transaction
  numbering so these unrelated contracts no longer share one mutable ref.
- Preserved independent undo histories across child/top document navigation;
  whole-Project replacement resets histories and returns to the top document.
- Reduced `App.tsx` from 7,016 to 6,961 lines without changing persisted data or
  the edit-engine boundary.

Validation completed on 2026-08-10:

- `pnpm typecheck`
- focused controller, editor-session, and App Vitest — 19 tests passed
- focused undo/redo, save/open, import, and recovery Playwright — 7 tests passed
- full `pnpm exec vitest run apps/editor/src` — 16 files, 62 tests passed
- full `pnpm exec playwright test` — 59 tests passed
- `pnpm --filter @icm/editor... build`
- `git diff --check`

The existing dirty documentation target and shared `plan/log.md` were not
edited. Recovery timer/page lifecycle remains a separate browser-shell concern;
the next structural target can isolate that lifecycle or begin splitting the
geometry-heavy canvas interaction controllers.
