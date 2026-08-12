---
status: completed
experience: none
---

# Filter project ERC diagnostics by severity

## Goal

Add a compact severity filter to the project ERC shelf so large imported
designs can focus errors, warnings, or informational results without deleting
or mutating any diagnostic fact.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns only ERC presentation state and its
tests. The diagnostic producer and canonical navigation contracts are
read-only dependencies.

- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c9c/plan.md`
- `plan/log.md`

## Work

1. Add All/Error/Warning/Info presentation filters with counts.
2. Keep source Cell identity and locator actions unchanged.
3. Cover filtering and cross-Cell diagnostic navigation in focused tests.

## Validation

- selection inspector unit tests and focused editor Playwright flow
- workspace typecheck, `git diff --check`, and status

## Commit Intent

```text
feat(editor): filter project ERC diagnostics
```

## Outcome

Added All/Error/Warning/Info severity filters with visible counts to the project
ERC shelf. The filter changes presentation only; Cell labels and canonical
diagnostic navigation remain intact. Focused unit, browser, and type checks
passed.
