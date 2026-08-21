---
status: completed
experience: none
---

# Always-Open Insert Picker List

## Goal

User request: after pressing `I`, the component list must simply BE there —
no dropdown to pull open, no re-expanding after each pick, and one fewer
click wherever possible. The Insert dialog's picker list becomes permanently
visible: the collapse toggle is removed, selecting an item no longer folds
the list, the visible list area grows, and double-clicking an item applies
it immediately (single click still selects for parameter/rotation tweaks
before Apply). Keyboard flow (type to filter, arrows, Enter) is unchanged.

## State and Ownership

Branched from `origin/main` (PRs #142–#147 merged) as
`claude/insert-picker-always-open`; worktree clean. A chip session holds
`main` in a separate worktree; this target does not touch it.

Owned paths:

- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
  and `insert-component-dialog.test.tsx`
- `apps/editor/src/styles.css` (picker list height)
- `apps/editor/e2e/component-insert.spec.ts` (collapse-dependent stability
  test rewritten for the always-open contract; new double-click scenario)
- `plan/2026-08-21-insert-picker-always-open/plan.md`, `plan/log.md`

Shared dependencies: the Insert dialog markup consumed by the
`chooseComponent` e2e fixture (unchanged: search, option click, Apply all
keep working).

## Work

1. Remove the `pickerOpen` state and the collapse/expand toggle; render the
   options listbox unconditionally with `aria-expanded` fixed open.
2. `selectChoice` keeps the list visible; double-click on an option applies
   it through the existing `apply()` path (the first click of the pair has
   already committed the selection).
3. Raise the bordered list's height cap so more of the catalog is visible
   without scrolling.
4. Update the dialog markup test, rewrite the collapse steps of the layout
   stability e2e around the always-open contract, and add a double-click
   placement scenario.

## Validation

- focused `vitest`:
  `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- `playwright`: `apps/editor/e2e/component-insert.spec.ts`
- repository typecheck, prettier
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the picker list is always visible (no collapse control; it
  survives selection); double-clicking an option applies it immediately;
  existing search/keyboard/Apply flows unchanged
- Primary checks:
  `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`,
  `apps/editor/e2e/component-insert.spec.ts`

## Commit Intent

Committed on `claude/insert-picker-always-open` under the user's standing
commit-push-merge direction as:

```text
feat(editor): keep the insert picker list always open
```

## Outcome

Delivered. The Insert dialog's catalog is now permanently visible: the
`pickerOpen` state and collapse/expand toggle are gone, selecting an item
keeps the list in place for the next pick, the bordered list's height cap
grew to `min(26rem, 48vh)`, and double-clicking an option applies it
immediately through the existing `apply()` path (the pair's first click
already commits the selection, so parameters and rotation state are
consistent). Search, arrow-key, Enter, and Apply flows are unchanged, as is
the `chooseComponent` e2e fixture. Validation: component-insert unit suite
(10 files / 40 tests), full component-insert Playwright suite 22/22 —
including the rewritten always-open layout-stability scenario and a new
double-click-places-immediately scenario — repository typecheck, prettier,
test-impact, and diff checks green; behavior confirmed live in the editor.
