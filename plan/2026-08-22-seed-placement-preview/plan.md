---
status: completed
experience: none
---

# Placement ghosts appear under the cursor immediately

## Goal

Pressing `C` sometimes started a copy with nothing following the pointer. The
preview point was only ever set from the canvas `pointermove` handler, so a
placement started from the keyboard stayed invisible until the pointer moved
— and the pointer is usually already sitting still over the canvas at that
moment.

## State and Ownership

Start state: clean worktree on `main`. Branch `claude/seed-placement-preview`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-seed-placement-preview/plan.md`, `plan/log.md`

## Work

1. Remember the last pointer position seen on the canvas, in document
   coordinates.
2. Seed the ghost from it when a copy or component placement begins, so the
   preview is on screen before the next move. Component placement gets the
   same treatment because it has the same gap.

## Validation

- repository typecheck, prettier
- the new browser test, run with the fix stashed to prove it fails without it
- editor unit tests; full Playwright suite

## Gate Review

- Decision: affected — editor interaction state only.
- Early gates: prettier, the focused browser test.
- Affected gates: the component-insert browser spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none.

## Test Impact

- Decision: tests-updated
- Contracts: a copy started from the keyboard shows its ghost at the cursor
  without a pointer move.
- Primary checks: `apps/editor/e2e/component-insert.spec.ts` — "Copy shows its
  ghost under the cursor without waiting for a move"

## Outcome

Reproduced first: after `C` the status bar announced the placement while
`copy-placement-preview` was absent, and it only appeared once the pointer
moved. With the seeded point the ghost is present immediately. The new test
was verified to fail with the fix stashed. Full Playwright suite: 189 passed.
