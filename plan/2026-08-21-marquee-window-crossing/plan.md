---
status: completed
experience: none
---

# Directional Marquee Selection and Native Text-Selection Fix

## Goal

Fix the reported "distant labels get selected by a marquee" bug and introduce
the classic directional marquee scheme. Diagnosis (reproduced in the running
editor): the editor's own marquee math never selected the distant labels —
dragging across the canvas starts a NATIVE browser text selection over the SVG
`<text>` labels (`.schematic-canvas` is `user-select: auto`), which highlights
labels in DOM order regardless of geometry (`window.getSelection()` held
"X1\nX2\nX3\nX4\nX5" after an empty-area drag). Fix: suppress native selection
on the canvas while keeping the rich-text editing overlay selectable.

New behavior (AutoCAD window/crossing): dragging left-to-right selects only
objects FULLY contained in the marquee (window, solid border); dragging
right-to-left selects anything partially covered (crossing, dashed border —
today's semantics). Junction points behave identically in both modes.

## State and Ownership

`git status --short --branch`: clean on `claude/marquee-window-crossing`,
branched from `claude/block-diagram-authoring` after its origin/main
merge-update (PR #142 pending its CI-then-merge chain). No overlap with other
sessions' active work.

Owned paths:

- `apps/editor/src/features/selection/marquee-selection.ts` (new) and test —
  the extracted pure marquee-set computation with a window/crossing mode
- `apps/editor/src/canvas/canvas-geometry.ts` and `canvas-geometry.test.ts`
  (containment helpers)
- `apps/editor/src/app/App.tsx` (finishCanvasGesture calls the module; box
  preview carries the mode class)
- `apps/editor/src/styles.css` (canvas `user-select: none`, overlay text
  restore, window/crossing marquee styles)
- `apps/editor/e2e/manual-editor.spec.ts` (window/crossing + no-native-text
  scenarios; audit existing marquee drags in `drafting.spec.ts` /
  `hierarchy.spec.ts` for direction assumptions)
- `docs/specs/editor-interaction.md` (marquee direction + native-selection
  clause in the movement/marquee section)
- `plan/2026-08-21-marquee-window-crossing/plan.md`, `plan/log.md`

Shared dependencies: the editor-interaction spec's marquee clauses (updated
deliberately here), selection replace semantics, and existing e2e marquee
gestures whose drag directions now carry meaning.

## Work

1. CSS: `.schematic-canvas { user-select: none; }` plus explicit
   `user-select: text` for the canvas text-editing overlay's editable and
   input surfaces.
2. Extract the box-selection filters from `finishCanvasGesture` into a pure
   `marqueeSelection(document, resolver, routeGeometryRecords, styleProfile,
   rect, mode)`; add `rectContainsRect` / polyline containment helpers to
   canvas-geometry. Window mode: instances/annotations/drafting bounds fully
   contained, routes with every centerline vertex inside, drafting rectangles
   with all four corners inside. Crossing mode keeps today's predicates.
3. Mode = `end.x < start.x ? "crossing" : "window"`; the live preview box
   shows solid border for window and dashed for crossing.
4. Update the editor-interaction spec marquee clauses; adjust existing e2e
   drags whose expectations depend on the old always-crossing semantics; add
   window/crossing and no-native-text-selection scenarios.

## Validation

- focused `vitest`: `apps/editor/src/features/selection`,
  `apps/editor/src/canvas/canvas-geometry.test.ts`
- `playwright` (local server reuse): `apps/editor/e2e/manual-editor.spec.ts`,
  `apps/editor/e2e/drafting.spec.ts`, `apps/editor/e2e/hierarchy.spec.ts`
- repository typecheck; `node scripts/check-markdown-links.mjs`
- `node scripts/check-test-impact.mjs --base <branch-base>`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: marquee window mode selects only fully-contained objects;
  crossing mode preserves partial-overlap selection; junctions identical in
  both modes; canvas drags never produce a native browser text selection;
  existing marquee-dependent flows keep their meaning under the direction
  they drag
- Primary checks:
  `apps/editor/src/features/selection/marquee-selection.test.ts`,
  `apps/editor/src/canvas/canvas-geometry.test.ts`,
  `apps/editor/e2e/manual-editor.spec.ts`

## Commit Intent

Committed on `claude/marquee-window-crossing` under the user's standing
commit-push-merge direction as:

```text
feat(editor): directional window/crossing marquee selection
```

## Outcome

Root cause confirmed and fixed: the "distant labels" were the browser's own
text selection, not editor state — `.schematic-canvas` now suppresses native
selection (`user-select: none`) with an explicit restore inside the
canvas text-editor overlay, and marquee sweeps leave `window.getSelection()`
empty (asserted in e2e). The box-selection filters moved into a pure
`features/selection/marquee-selection` module with the directional scheme:
left-to-right window (full containment: instance/annotation/drafting bounds,
whole route centerline, all four outline-rectangle corners), right-to-left
crossing (previous overlap semantics), junctions identical in both; the live
preview renders solid (window) vs dashed green (crossing). The
editor-interaction spec's marquee clauses were extended accordingly. One
existing browser test relied on partial coverage under a left-to-right drag;
its gesture now sweeps fully (trace-verified that the window correctly
excluded a body 10 units outside the rectangle while its label was inside).
Validation: 19 new unit tests (marquee module + geometry helpers) within
64 passing across selection/canvas/wiring, full manual-editor (88), drafting
(27+), and hierarchy suites green, repository typecheck, prettier, markdown
links, test-impact, and diff checks clean.
