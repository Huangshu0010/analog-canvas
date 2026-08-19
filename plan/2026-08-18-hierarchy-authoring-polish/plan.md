---
status: completed
experience: none
---

# Hierarchy authoring polish

## Goal

Replace browser Cell prompts with internal dialogs, make a child Cell Port's
single visible annotation the authoritative interface name, verify Cell
delete undo/redo, and expose the two retained Cell commands directly in the
hierarchy row when space permits.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/properties-panel-simplify...origin/main
?? .worktrees/
```

`.worktrees/` is unrelated user-owned infrastructure and remains untouched.
This target owns hierarchy dialogs, Port label projection, hierarchy toolbar
layout, structural-history regression coverage, current hierarchy docs, and
plan/log/audit records. The completed Properties Panel target is already
committed and the worktree is otherwise clean.

## Work

1. Add internal create/rename/delete Cell dialogs and remove native browser
   prompts and confirmations.
2. Create one constrained child-Port annotation from the formal terminal,
   synchronize edits atomically, and keep top-level Port annotations ordinary.
3. Add Cell deletion undo/redo coverage and expose Manage Cells and Place Cell
   directly in the hierarchy row with responsive collapse only when necessary.
4. Update focused documentation and browser/unit contracts.

## Validation

- focused hierarchy, annotation, and structural-history tests
- browser review of desktop and narrow hierarchy toolbar layouts
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Cell mutation stays in-app; child Port label and interface name
  stay one value; top-level Port remains ordinary; structural undo restores a
  deleted Cell and redo removes it again.
- Primary checks: hierarchy planner/controller unit tests and hierarchy
  Playwright coverage.

## Commit Intent

```text
feat(hierarchy): polish Cell authoring interactions
```

## Outcome

Replaced native Cell prompts with in-app Cell Manager dialogs, exposed the two
retained Cell commands directly in the hierarchy row, and made a child Cell
Port's object-anchored annotation the sole editable interface name. Annotation
rename, formal terminal, and parent symbol pins update through one Project
transaction. Formal Port delete now reuses the normal connected-instance delete
proposal and only appends hierarchy terminal/caller reconciliation. Browser
coverage verifies the internal dialogs, annotation rename, child Port delete
and undo, top-level Port behavior, and Cell delete undo/redo. Focused E2E,
docs/test-impact, diff check, and `pnpm verify:branch` passed (146 unit files /
889 tests, workspace build and production smoke).
