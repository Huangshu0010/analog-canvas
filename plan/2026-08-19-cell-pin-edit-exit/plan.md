---
status: completed
experience: none
---

# Exit transient Cell symbol pin editing predictably

## Goal

Make Cell symbol pin/body layout editing a scoped canvas mode that exits when
the user leaves its context, so it cannot interfere with ordinary selection or
device movement.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

`.worktrees/` is user-owned, untracked, and unrelated to this target. It will
not be modified. This target owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/hierarchy.spec.ts`
- `plan/2026-08-19-cell-pin-edit-exit/plan.md`
- `plan/log.md`

Shared dependencies: the existing hierarchy symbol presentation and canvas hit
testing contracts are read and preserved; no project protocol change is in
scope.

## Work

1. Bind the canvas layout mode to the selected Cell instance and centralize its
   exit path.
2. Exit automatically on a non-layout canvas action, Properties collapse,
   selection/document/context changes, and tool changes.
3. Add browser coverage proving the mode closes and ordinary component movement
   resumes.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Cell symbol layout grips are exclusive only while their owning
  instance remains selected; leaving that context restores normal canvas hit
  and movement behavior.
- Primary checks: `apps/editor/e2e/hierarchy.spec.ts` through the local browser
  test runner.

## Commit Intent

Commit as:

```text
fix(hierarchy): exit Cell symbol layout predictably
```

## Outcome

Cell symbol canvas layout now records its owning instance and exits through one
path when the selection/context changes, Properties closes, a tool changes, or
the user begins any ordinary canvas action. The hierarchy browser regression
also verifies that the normal Cell hit target and direct drag return after both
Properties collapse and a blank-canvas click.

Validation passed: `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts`
(6 scenarios), `pnpm typecheck`, `pnpm test:impact -- --base origin/main`, and
`git diff --check`.

Mainline delivery gate passed with `pnpm install --frozen-lockfile` followed
by `pnpm ci:check` (891 unit tests and 154 browser tests, plus static, build,
release, packaging, and production-smoke contracts). PR #126 also passed all
required GitHub checks before merge.
