---
status: completed
experience: none
---

# Hierarchy authoring and visual H4: Cell Manager

## Goal

Provide one caller-aware Cell management surface for create, rename, open, and
safe deletion without changing the existing Document/Instance lifecycle model.

## State and Ownership

Start state: clean branch `codex/hierarchy-authoring-visual-plan` except the
pre-existing user-owned untracked `.worktrees/`, which remains untouched.
This target owns the editor hierarchy-management UI, any narrow reusable
caller summary helper, focused tests/docs, and its planning records. Project
structural transaction and hierarchy navigation contracts are shared/read-only
unless a necessary planner gap is discovered.

## Work

1. Add a compact Cell Manager with name, port count, and caller count.
2. Make creation, rename, open, caller jump, and protected deletion available
   through that surface, retaining normal Instance deletion as the way to
   remove callers.
3. Cover referenced/unreferenced lifecycle and shared-caller navigation.

## Validation

- focused editor/unit and hierarchy Playwright tests
- `pnpm docs:check`, `pnpm test:impact -- --base origin/main`, diff check
- `pnpm verify:branch` before delivery

## Test Impact

- Decision: tests-updated
- Contracts: a Cell definition is removed only when non-top and unreferenced;
  caller navigation carries a concrete instance path.
- Primary checks: hierarchy navigation/project transaction and browser workflow.

## Commit Intent

```text
feat(hierarchy): add caller-aware Cell Manager
```

## Outcome

Completed the caller-aware Cell Manager. It centralizes open, create, rename,
and safe deletion; displays formal-port/caller counts; lists each caller with
an exact jump target; and disables referenced/top deletion. The new structural
rename operation updates the child metadata and every caller's binding and
derived Symbol identity atomically.

Validation passed: focused Project-transaction Vitest (10 tests), hierarchy
Playwright (4 scenarios), `pnpm typecheck`, `pnpm docs:check`, test-impact,
diff check, and `pnpm verify:branch` (144 files / 881 tests, workspace build,
production smoke).
