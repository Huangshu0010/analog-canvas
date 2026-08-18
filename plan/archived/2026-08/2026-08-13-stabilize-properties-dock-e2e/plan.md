---
status: completed
experience: none
---

# Stabilize Properties Dock Resize E2E

## Goal

Repair the flaky Properties-dock browser assertion reported by PR #36 without
changing editor or Analytics behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/stabilize-properties-e2e...origin/main
```

The worktree is clean. This target owns only the affected browser test, its
target plan, and the factual log entry.

- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-13-stabilize-properties-dock-e2e/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- Properties dock transition and canvas layout in `apps/editor/src/styles.css`
- existing Properties interaction contract

## Work

1. Replace the immediate post-click canvas-width assertion with a bounded
   Playwright poll that waits for the existing CSS transition to complete.
2. Keep the semantic assertion that opening Properties reduces available canvas
   width; do not alter UI layout, timing, or Analytics code.
3. Run the affected E2E using the capped local command, then push a dedicated
   repair PR for remote CI verification.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "keeps component insertion and inspection from resizing the canvas"`
- `git diff --check`
- `git status --short --branch`

The focused browser check covers the reported transition race. Remote CI must
run the complete required browser shards before this repair can merge.

## Commit Intent

Commit as:

```text
test(e2e): wait for Properties dock canvas transition
```

## Outcome

The immediate geometry sample raced the existing 160 ms Properties-dock CSS
transition on the remote runner. The test now polls until the canvas has
actually narrowed, preserving the layout assertion without modifying product
behavior. The capped local target E2E passed; remote CI remains required
before merge. PR #37 then passed all remote CI jobs, including both browser
shards.
