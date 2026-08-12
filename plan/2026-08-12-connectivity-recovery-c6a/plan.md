---
status: completed
experience: none
---

# Surface hierarchical Net trace paths in the editor

## Goal

Expose the existing bidirectional hierarchy Net trace as a compact, navigable
path list once a Net is highlighted, so users can see each concrete caller
instance and traverse to the corresponding Cell/Net.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns only presentation/navigation of the
already-tested trace model; hierarchy derivation and highlight overlay stay
read-only.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c6a/plan.md`
- `plan/log.md`

## Work

1. Render trace hop direction, instance/pin and destination Cell/Net in the
   persistent selection workbench.
2. Navigate a hop through the canonical locator path and retain highlight.
3. Add unit/browser regression coverage for trace presentation and navigation.
4. Update factual trace status after the UI exit condition is verified.

## Validation

- focused selection/trace tests and browser navigation flow
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
feat(editor): navigate hierarchy Net trace paths
```

## Outcome

The selection workbench now shows each concrete up/down hierarchy hop for a
highlighted Net and navigates the destination with the canonical locator. The
browser regression verifies entering a child Cell and retaining its Net
highlight after clicking the visible path.

Validation passed: nine focused selection/trace tests, focused browser trace
navigation, workspace typecheck, targeted Prettier, and `git diff --check`.
