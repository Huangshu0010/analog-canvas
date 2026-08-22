---
status: completed
experience: none
---

# Escape dismisses the Insert dialog regardless of focus

## Goal

`component-insert.spec.ts:376` failed in four separate full-suite runs this
session and passed on every isolated re-run, so it was being treated as a
timing flake. It is not: it exposes a real dismissal gap.

## State and Ownership

Start state: clean worktree on `main`. Branch `claude/fix-copy-mode-flake`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-insert-dialog-escape/plan.md`, `plan/log.md`

## Work

The Insert dialog focuses its search field inside a `requestAnimationFrame`,
and its Escape handler lives on the dialog form. An Escape delivered in that
gap therefore reaches the window instead, where no case covered the dialog, so
the dialog stayed open and its backdrop swallowed every later pointer action —
which is exactly what the spec's `canvas.hover` timeout reported.

1. Handle Escape for the open Insert dialog at the window level, beside the
   existing search-dialog case.
2. Replace the spec's incidental coverage with a deterministic test: open the
   dialog, move focus outside it, press Escape, and require the dialog to go.

## Validation

- repository typecheck, prettier
- the changed spec file run three times end to end
- the new test run with the fix reverted, to prove it fails without it
- full unit suite; full Playwright suite

## Gate Review

- Decision: affected — one editor shell key handler.
- Early gates: prettier, the focused browser test.
- Affected gates: the component-insert browser spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none.

## Test Impact

- Decision: tests-updated
- Contracts: Escape dismisses the Insert dialog no matter which element holds
  focus.
- Primary checks: `apps/editor/e2e/component-insert.spec.ts` — "Escape closes
  the Insert dialog even when focus is outside it"

## Outcome

Before the fix the spec file failed two runs out of three; after it, three
runs out of three passed, and the full browser suite is green at 188. The new
test was verified to fail with the fix stashed, so it protects the behavior
rather than the timing.
