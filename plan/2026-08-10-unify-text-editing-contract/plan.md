# Unified Text Editing Contract

## Goal

Unify annotation and drafting-text editing behind one tagged session and pure
commit contract. The shared floating editor should not depend on two parallel
lookup, equality, deletion, and persistence implementations in App.

## Dirty-State Decision

Frontend architecture stages through `3e2166e` are committed. Concurrent
documentation, plan archive, reference, and shared-log changes remain dirty
but do not overlap this target. They remain read-only and unstaged.

## Owned Files

- `apps/editor/src/App.tsx`: text session derivation and command wrappers only
- `apps/editor/src/text-editing.ts`
- `apps/editor/src/text-editing.test.ts`
- `plan/2026-08-10-unify-text-editing-contract/plan.md`

## Read-Only Files

- `apps/editor/src/rich-text-editor.tsx` presentation behavior
- Existing E2E specifications and Playwright configuration
- Model, edit-engine, and renderer contracts
- All concurrent dirty paths, including `plan/log.md`

## Shared Dependencies

- Annotation and drafting text retain one RichTextEditor UI and Razavi
  typography behavior.
- Untouched semantic annotations still open with canonical composed rich text;
  explicitly saved annotation ASTs still round-trip exactly.
- Empty committed content still maps to deletion.
- Locked or missing targets do not produce persistence edits.
- Unchanged content and size do not create revisions.
- The pure contract returns typed edits and explicit outcomes; it cannot
  transact, select, set React state, or emit status.

## Expected Work

1. Define tagged editable targets and one shared text-editing session type.
2. Centralize target resolution, session updates, deletion edits, rich-text
   equality, and commit proposal generation.
3. Add tests for annotation defaults, drafting text, update, no-op, deletion,
   locked, and missing cases.
4. Replace App's owner branches with thin selection and transaction wrappers.

## Validation

- Focused text-editing and App unit tests
- Focused annotation/drafting text creation, format, size, apply, delete,
  cancel, drag, persistence, and no-revision Playwright flows
- Full editor Vitest and Playwright suites
- `pnpm typecheck`, `pnpm build`, `git diff --check`, status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): unify text editing commands
```

The shared maintenance log remains deferred to its concurrent owner.

## Outcome

- Added one tagged text target/session contract for annotations and drafting
  text, with shared target resolution, session updates, deletion edits, rich
  text equality, and commit proposals.
- Reduced `App.tsx` by 73 lines and removed parallel owner-specific commit
  branches; App now handles only selection, transactions, status, and floating
  editor visibility.
- Preserved canonical semantic annotation composition, exact saved ASTs,
  size-scale behavior, empty-text deletion, locked/missing refusals, and
  unchanged-content revision suppression.
- Added six contract tests covering both owners and every proposal outcome.

## Validation Result

- Focused Vitest: 17 passed.
- Focused text-editing Playwright: 9 passed.
- Full editor Vitest: 92 passed across 21 files.
- Full Playwright: 59 passed under the current fully-parallel setting.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; the existing Vite large-chunk advisory remains.
- Final `git diff --check` and status audit run immediately before commit.
- `plan/log.md` remains unstaged because its dirty state belongs to the
  concurrent repository-maintenance target.
