# Unified canvas interaction session

## Goal

Remove the divergent canvas pointer implementations and replace them with one
editor-local interaction path: semantic hit resolution at pointer-down, one
drag controller for threshold/capture/cancellation, live grab-offset-preserving
visual feedback, and one typed commit at pointer-up.

## Dirty-State Decision

The worktree contains separately owned editor-chrome work in
`apps/editor/src/styles.css` and
`plan/2026-08-10-editor-chrome-modernization/`. This target does not edit,
stage, or commit those paths. `App.tsx` is currently clean and available for
this target.

During an earlier browser validation attempt, all tracked files under the shared
`model`, `derived`, `edit-engine`, `render-svg`, `symbols`, `spice`, and
`exporters` packages were externally removed from the working tree. These
deletions were not owned by this target and were left untouched. They have now
been restored externally. Concurrent floating-control and topology-aware route
work remains dirty; this target owns only canvas hit/drag hunks in `App.tsx`
and does not stage their CSS, Derived, renderer, or inspector hunks.

## Owned Paths

- `apps/editor/src/canvas-drag-session.ts`
- `apps/editor/src/canvas-drag-session.test.ts`
- `apps/editor/src/canvas-hit-resolver.ts`
- `apps/editor/src/canvas-hit-resolver.test.ts`
- `apps/editor/src/canvas-drag-visual.ts`
- `apps/editor/src/canvas-drag-visual.test.ts`
- `apps/editor/src/App.tsx` (drag-session integration hunks only)
- `apps/editor/e2e/manual-editor.spec.ts` (gesture regressions only)
- `apps/editor/e2e/drafting.spec.ts` (shared-session regression wording only)
- `docs/specs/editor-interaction.md` (pointer gesture contract only)
- `plan/2026-08-10-unified-canvas-drag-session/plan.md`
- `plan/log.md` (this target entry only)

## Read-Only Paths

- `apps/editor/src/styles.css` and the concurrent chrome plan
- model, edit-engine, renderer, and persisted Project schemas
- symbol and formal-rendering assets

## Expected Work

1. Add a single pointer drag-session controller using one movement threshold,
   pointer capture, `requestAnimationFrame` coalescing, and unified
   pointer-up/cancel cleanup.
2. Integrate instance, annotation, drafting-object, and route dragging with the
   controller; remove their duplicated pointermove/pointerup session plumbing.
3. Keep previews transient and commit exactly one existing typed transaction
   at pointer-up. Do not add persisted state or Agent/API protocol.
4. Preserve current object-specific movement semantics: group move and local
   route stretch, bounded label move, kind-aware drafting translation, loose
   route translation, and connected-segment stretch.
5. Cover controller lifecycle and representative browser gestures.
6. Resolve overlapping hit targets once at pointer-down using explicit
   semantic priorities and keep that target latched for the whole gesture.
7. Move the painted target continuously with the unsnapped pointer delta;
   retain the original grab offset and defer grid/electrical snap to commit.
   The live preview must update SVG geometry directly instead of rebuilding the
   formal scene on every pointermove.

## Validation

- Focused controller Vitest and editor browser gestures.
- Editor TypeScript check and production build.
- Prettier, `git diff --check`, and dirty-state ownership review.

## Commit Intent

```text
refactor(editor): unify canvas drag sessions
```

## Outcome

- Replaced object-specific window listeners with one thresholded, pointer-
  captured, animation-frame-coalesced drag session.
- Added semantic hit ranking at the canvas capture boundary. The target is
  resolved once, selected objects remain sticky, and `Alt` selects the next
  overlapping candidate.
- Added a lightweight SVG live-preview adapter. Instances and attached labels,
  annotations, drafting objects, loose Routes/Junctions, and connected Route
  polylines and Guides follow the unsnapped pointer while preserving the grab
  offset. Preview attributes are restored before one snapped typed transaction.
- Removed unused React drag-preview states and the duplicate default-label hit
  layer whenever an explicit instance-label annotation exists.
- Validation passed: 10/10 focused controller/resolver/visual geometry Vitest,
  App Vitest 11/11, ten focused drafting/manual Playwright gestures, editor
  TypeScript, production build, Prettier, and `git diff --check`.
- Commit remains pending because `App.tsx`, both browser-test files, the
  interaction specification, and `plan/log.md` also contain concurrent dirty
  targets. Exact-hunk staging must be coordinated rather than mixing them.
