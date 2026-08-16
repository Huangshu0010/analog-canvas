---
status: completed
experience: none
---

# Unified Selection Move

## Goal

Make `M` a keyboard entry point for the editor's existing connectivity-aware
move behavior, without narrowing mixed visual selection. Direct dragging and
`M` must share one selection move planner and committed edit path.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/refine-about-repository-link...origin/agent/refine-about-repository-link
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated local workspace state and
will not be touched. This target starts from updated `main` on
`codex/unified-selection-move`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/interaction/interaction-state.ts`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/src/features/selection/selection-move-plan.ts`
- `apps/editor/src/features/selection/selection-move-plan.test.ts`
- focused editor interaction tests when a matching suite exists
- `plan/2026-08-16-unified-selection-move/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `@icm/edit-engine` group move and route stretch proposals
- model grid-coordinate contract

## Work

1. Generalize the selection move plan so a movable visual selection need not
   contain an instance; preserve topology constraints for attached routes,
   locked objects, and attachment-following labels.
2. Extract one move-session entry point consumed by pointer dragging and `M`.
   Keep the existing instance electrical snap behavior and add deterministic
   visual-only movement without a parallel transaction path.
3. Add `M` shortcut arbitration and an armed canvas interaction that can be
   cancelled safely. Do not alter the agreed existing key bindings.
4. Add focused unit/browser coverage for shortcut mapping, mixed planning,
   keyboard movement cancellation, and one-transaction commit behavior.

## Validation

- `pnpm test:local apps/editor/src/features/selection/selection-move-plan.test.ts apps/editor/src/interaction/editor-shortcuts.test.ts`
- focused editor browser tests covering move behavior if available
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): unify keyboard and pointer selection move
```

## Outcome

Implemented a cancellable `moving-selection` interaction state and mapped `M`
to it. Pointer dragging and `M` now consume the same `VisualSelection` and
`SelectionMovePlan`; instance-led groups retain electrical snapping/stretch,
while visual-only selections use the same loose-route, free-annotation, and
drafting-object commit helpers. A selected non-loose Route still enters its
existing segment-stretch behavior. Root-SVG keyboard entry was normalized after
browser coverage exposed the old child-element-only assumption.

Validation passed: focused unit tests (38), focused Playwright `M` test, the
complete manual-editor Playwright suite (67), workspace typecheck, Prettier,
and `git diff --check`.

Committed as `f07c65c` (`feat(editor): unify keyboard and pointer selection
move`) and pushed to `codex/unified-selection-move-20260816` after an existing
remote branch claimed the shorter name.
