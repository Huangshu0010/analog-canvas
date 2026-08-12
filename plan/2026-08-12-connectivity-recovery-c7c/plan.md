---
status: completed
experience: none
---

# Persist Net highlight across hierarchy Cells

## Goal

Make the editor consume the existing bidirectional hierarchy Net trace: a Net
highlight started in one Cell remains meaningful when users navigate to another
reachable Cell, showing that Cell's corresponding Net instead of reusing an
unscoped Net id.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target changes only non-persisted highlight state.
It does not render simultaneous multi-Cell canvases or alter electrical Nets.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c7c/plan.md`
- `plan/log.md`

## Work

1. Store highlight origin as a document/net pair, not an unscoped Net id.
2. Resolve the current Cell overlay from `traceHierarchyNet()` highlights.
3. Preserve existing route and search highlight actions while allowing locator
   navigation to establish the correct origin Cell.

## Validation

- focused derived/editor tests and Playwright Net highlight regression
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): retain Net highlights across hierarchy Cells
```

## Outcome

Replaced unscoped Net-id highlight state with a document/net origin. The editor
now resolves the current overlay from the existing bidirectional hierarchy trace
so a highlighted logical Net follows navigation to any reachable Cell. Existing
Net trace/App tests, the route-highlight browser regression, and workspace
typecheck passed.
