---
status: completed
experience: none
---

# Insert dialog component list default expanded

## Goal

Make the component list in the `I` (Insert Component) dialog expanded by
default each time the dialog opens. No other behavior changes: the collapse
toggle, search re-open, and select-to-collapse interactions stay as they are.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/command-move-shortcuts...origin/codex/command-move-shortcuts
?? .worktrees/
```

Worktree is clean except the untracked `.worktrees/` directory, which is
unrelated to this target and safe to leave untouched. Branching from
`origin/main` (7e144c5).

- Owned: `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- Owned: `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- Owned: `apps/editor/e2e/component-insert.spec.ts`
- Owned: `plan/2026-08-16-insert-dialog-list-default-expanded/plan.md`, `plan/log.md`

Read-only: everything else. No shared package contracts are touched.

## Work

1. Change `pickerOpen` initial state and the dialog-open reset from `false`
   to `true` so the list renders expanded on open.
2. Update the unit test contract that asserted the collapsed default.
3. Update the two e2e spots that assumed the list starts collapsed.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts`
- `git diff --check`
- `git status --short --branch`
- Mainline gate before merge to main: `pnpm install --frozen-lockfile` +
  `pnpm ci:check`, then push branch and wait for required GitHub Actions
  checks before merging.

## Commit Intent

Commit as:

```text
feat(editor): expand insert dialog component list by default
```

## Outcome

Changed `pickerOpen` initial state and the dialog-open reset to `true` so the
component list renders expanded whenever the Insert Component dialog opens.
Collapse toggle, search re-open, and select-to-collapse behavior unchanged.
Updated the unit contract to assert the expanded default and adapted two e2e
spots that assumed a collapsed start.

Validation: unit test 2/2 passed; e2e `component-insert.spec.ts` 17/17 passed;
`git diff --check` clean. Delivered via PR merge to `main`.
