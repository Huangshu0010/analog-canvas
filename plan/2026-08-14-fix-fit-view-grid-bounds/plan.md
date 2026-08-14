---
status: completed
experience: none
---

# Normalize Fit View bounds into the editor grid camera

## Goal

Prevent `F`, `Home`, and the Fit View button from crashing the editor when
derived visual bounds contain fractional values from text, curves, or rotation.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean before this target. This target owns:

- `apps/editor/src/canvas/fit-view.ts`
- `apps/editor/src/canvas/fit-view.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/drafting.spec.ts` for the keyboard regression
- `plan/2026-08-14-fix-fit-view-grid-bounds/plan.md`
- `plan/log.md`

Read-only dependencies:

- `packages/render-svg/src/render.ts`: derives export/visual bounds that may
  be fractional.
- `packages/model/src/schema.ts`: editor camera bounds must satisfy integer
  `RectSchema`.
- `apps/editor/src/interaction/editor-shortcuts.ts`: owns the existing F/Home
  command mapping and is not changed by this target.

## Work

1. Add one explicit derived-bounds-to-grid-camera conversion that rounds
   outward and guarantees a positive, integer, grid-aligned `Rect`.
2. Use it only at the Fit View editor boundary.
3. Cover fractional bounds in a unit test and `F` after drafting text in a
   browser regression.

## Validation

- `pnpm test:local apps/editor/src/canvas/fit-view.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts --grep "fits drafting text with F"`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): normalize fit view bounds to grid
```

## Outcome

Added a single editor-boundary adapter that rounds fractional renderer bounds
outward to the current grid before they become the camera `viewBox`. `F`,
`Home`, and the Fit View button retain their existing command path and now
share this safe conversion. Added unit coverage for fractional and aligned
bounds, plus a browser regression that creates drafting text and presses `F`.

Validation passed:

- `pnpm test:local apps/editor/src/canvas/fit-view.test.ts` (2 tests)
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts --grep "fits drafting text with F"` (1 test)
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts` (24 tests)
- `pnpm ci:check` (651 unit tests, 104 browser tests, builds, release smoke)
- `git diff --check`
