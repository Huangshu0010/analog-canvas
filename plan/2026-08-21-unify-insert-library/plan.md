---
status: completed
experience: none
---

# Unify Insert and Library orchestration

## Goal

Make Library, full Insert, and hierarchical Cell placement three views of one
editor-local insertion flow. Replace the ambiguous `cellOnly` boolean with an
explicit scope, share candidate selection through one request path, and retain
existing typed Edit Engine transactions.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/main
```

The isolated worktree is clean and based on `origin/main` at `ff89fb95`.

Owned paths:

- `apps/editor/src/features/component-insert/`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/app/App.tsx`
- focused component-insert, Library, and browser insertion tests
- `docs/specs/editor-interaction.md`
- this plan and `plan/log.md`

Read-only shared dependencies:

- Project/model schema, typed edits, connectivity planners, and VDD-rail
  planning remain the existing mutation authority.
- current instance-display authoring semantics are inputs to insert planning,
  not part of this target.

## Work

1. Define an explicit Insert scope and candidate-selection contract that
   represents all candidates versus Cell-only placement without a boolean mode.
2. Make the dialog title, candidate filtering, and opening status reflect that
   scope; preserve an optional preselected candidate for Library actions.
3. Route Library quick-place, Library/full Insert, `I`, and Place Cell through
   the same controller boundary and remove obsolete state/arguments.
4. Add regression coverage that opening/cancelling Cell insertion cannot leak
   into later full Insert or Library flows.
5. Record the editor-local protocol boundary and user-visible semantics.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/insert-launch.test.ts apps/editor/src/features/component-insert/insert-component-dialog.test.tsx apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep=Library`
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts --grep="places an existing Cell"`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: full Insert always exposes ordinary devices; Cell placement exposes
  only Cells; cancelling or switching scopes leaves no filtering state behind;
  Library and dialog requests share a typed selection contract.
- Primary checks: insert-dialog and controller unit tests plus the existing
  browser Library/Insert workflow.

## Commit Intent

Commit as:

```text
refactor(editor): unify insert and library flow
```

## Outcome

Completed the editor-local `InsertLaunch` contract with explicit `all` and
`cells` picker scopes. Library quick placement, Library/full Insert, `I`,
Port insertion, Cell placement, and dialog confirmation now all enter the same
controller; existing placement planners and Edit Engine contracts remain
unchanged. The dialog identifies Cell-only mode and regression coverage proves
that cancelling it cannot filter a later full Insert.

Validation passed: focused unit tests (3 files / 9 tests), focused Library
browser flows (3 tests), the Cell scope-leak browser regression, workspace
typecheck, Prettier, test-impact, and diff checks. The combined `|` Playwright
grep is not portable through the Windows script wrapper, so the two focused
equivalent commands above were used instead.

Commit: `refactor(editor): unify insert and library flow` on the current
branch HEAD.
