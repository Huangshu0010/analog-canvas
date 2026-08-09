# Virtuoso-style wire endpoint semantics

## Goal

Align manual wire behavior with schematic-editor expectations: a dangling wire
end is an invisible, movable route anchor rather than a branch dot; only a
real multi-route branch draws a junction dot; and an isolated route can move as
a whole without leaving its endpoints apparently pinned to the canvas.

## Dirty-State Note

The worktree contains separately owned, uncommitted drafting-arrow/schema/
renderer changes as well as the preceding editor selection targets. The user
explicitly asked for this wire-semantics correction now. This target owns only
the isolated route-anchor and renderer junction-display hunks, a small editor
route-translation helper/test, and its plan/log entry. It must not alter the
unrelated drafting-arrow/schema hunks or stage them.

## Owned Files

- `apps/editor/src/App.tsx` (manual free-end and route-handle hunks only)
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/render-svg/src/render.ts` (junction visibility hunk only)
- `packages/render-svg/src/render.test.ts`
- `plan/2026-08-09-virtuoso-wire-semantics/plan.md`
- `plan/log.md` (this target's entry only)

## Read-Only Files

- model junction-role schema and edit-engine transaction contract
- current drafting-arrow schema/geometry/rendering hunks
- Agent route-expander behavior

## Shared Dependencies

- `route-anchor` and `branch` are existing persisted Junction roles.
- Route endpoints remain explicit Junction endpoints; no connectivity is
  inferred from geometry.
- Existing connected-route stretch behavior remains the path for a route whose
  endpoint is attached to a terminal, port, or real branch.

## Expected Work

1. Make GUI free-wire starts/finishes persist `route-anchor`, not the implicit
   default `branch`.
2. Render a branch dot only when a branch Junction has degree three or greater;
   hide `route-anchor`, label-anchor, and legacy degree-one/two branch markers.
3. Keep route anchors available as invisible wire endpoints in the GUI.
4. When both endpoints of a selected route are loose route anchors, dragging
   any selected wire segment translates its entire geometry and both anchors
   in one typed transaction. A selected route attached to a terminal, port, or
   real branch uses the same direct gesture to stretch the pointed segment.
   The centre handle remains an optional visible affordance, not the only move
   path.
5. Add renderer and browser regressions for dot-free loose ends and moving an
   isolated route.

## Validation

- Focused renderer tests and editor Vitest.
- Focused Playwright dangling-wire/route-translation gesture.
- Editor TypeScript check and production build.
- Prettier, `git diff --check`, and shared-worktree ownership review.

## Commit Intent

```text
fix(editor): treat loose wire ends as route anchors
```
