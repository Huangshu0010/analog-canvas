---
status: completed
experience: none
---

# Stabilize narrow Library layout browser assertion

## Goal

Make the existing narrow-breakpoint Library browser test wait for its
asynchronous layout change instead of sampling the canvas width too early.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/connected-wire-move-delete
```

The worktree was clean after commit `4c11e7a`. This separate test-maintenance
target owns only:

- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-17-stabilize-narrow-library-e2e/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

## Work

1. Replace the immediate post-toggle width read with a bounded Playwright poll.
2. Repeat the focused scenario, then rerun the full local delivery gate.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "keeps a usable canvas while toggling Library" --repeat-each=3`
- `pnpm test:impact -- --base origin/main`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the existing Library-open layout assertion remains unchanged; the
  test now observes it after layout settles.
- Primary checks: repeated focused Playwright scenario and the full local gate.

## Commit Intent

Commit as:

```text
test(editor): wait for narrow Library layout
```

## Outcome

The narrow Library test now polls until the canvas contracts after the panel
opens, then retains the same minimum-width and restore assertions. The focused
scenario passed three consecutive runs, and the complete local delivery gate
passed: static contracts, 824 unit/integration tests, build/release checks, and
all 146 browser tests.
