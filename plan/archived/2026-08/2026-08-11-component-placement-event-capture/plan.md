---
status: completed
experience: none
---

# Component Placement Event Capture

## Goal

Ensure a pending component placement commits from any primary-pointer target
inside the schematic canvas, including SVG grid primitives, rather than being
discarded by the normal pointer-mode target guard.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-11-component-placement-event-capture/plan.md`
- `plan/log.md`

This does not change model, transaction, or Agent API contracts. It uses the
existing pending-placement state and `add_instance` edit path.

## Work

1. Make any canvas click, rather than pointer-down, the sole pending-placement
   commit point, before normal tool routing or SVG target filtering.
   Pointer-down must suppress normal selection/move gestures during that
   pending click. Semantic/automation clicks that do not report a mouse detail
   remain valid placement gestures.
2. Add an end-to-end regression that targets a non-rect SVG child while the
   placement session is active.
3. Verify both normal and hostile-target placement still produce one instance
   and exit placement mode.

## Validation

- Focused component insertion E2E tests.
- Workspace typecheck, editor production build, `git diff --check`, and status
  review.

## Commit Intent

```text
fix(editor): capture all component placement clicks
```

## Outcome

Pending placement no longer relies on SVG child hit-testing or a preceding
pointer-down event. It suppresses the ordinary pointer selection gesture, then
commits the existing placement request from the following canvas click before
normal tool routing. The focused insertion E2E suite includes a semantic click
with `detail: 0` and no pointer-down; all 6 insertion scenarios, workspace
typecheck, production editor build, and `git diff --check` passed.
