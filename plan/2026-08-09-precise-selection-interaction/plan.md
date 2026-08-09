# Precise selection interaction

## Goal

Prevent accidental selection and movement of components and text while keeping
schematic objects easy to select. Replace the oversized symbol-viewBox hit area
with a tight visible-geometry bound, require an intentional screen-space drag
distance before moving an instance, and remove the obsolete circular drag
placeholder.

## Dirty-State Note

Start state contains unrelated, unstaged Razavi resistor-proportion work in
`packages/render-svg/`, `packages/symbols/`, and its target plan. During this
target, a separate uncommitted drafting-arrow edit also appeared in `App.tsx`
and `styles.css`. Its waypoint/inline-inspector hunks do not overlap the
selection code below. Leave every external hunk unmodified; stage only this
target's exact hunks.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/App.test.tsx`
- `apps/editor/src/selection-geometry.ts`
- `apps/editor/src/selection-geometry.test.ts`
- `plan/2026-08-09-precise-selection-interaction/plan.md`
- `plan/log.md` (only this target's appended entry)

## Read-Only Files

- `packages/derived/src/visual.ts`
- `packages/render-svg/src/render.ts`
- symbol definitions and Razavi-proportion worktree changes

## Shared Dependencies

- Symbol resolver/viewBox and primitive schemas remain unchanged.
- Existing instance move transactions and connected-route stretch behavior must
  remain unchanged after a drag has crossed the threshold.
- Existing annotation/drafting hit targets are not redefined in this bounded
  target; the same threshold pattern can be applied later after the component
  path has been verified.

## Expected Work

1. Add a small pure geometry helper that derives the component hit rectangle
   from visible symbol primitives and pins,
   transformed through the placement, rather than from the broad declaration
   viewBox where possible.
2. Record raw pointer coordinates for an instance, annotation, or free
   drafting gesture and require a 4px
   screen-space movement threshold before previewing or committing a move.
   A click must still select the object without creating a transaction.
3. Remove the legacy circular drag-preview overlay. Retain selected-object
   feedback via the tight selected bounds.
4. Make implicit component labels select-only on first click. Double-click
   materializes the label and opens its editor; subsequent explicit labels use
   the same thresholded drag path.
5. Add focused geometry/editor assertions for the tighter selection contract.

## Validation

- Focused `apps/editor/src/App.test.tsx` Vitest: protects rendered interaction
  targets and established label behavior.
- Editor production build: catches React/SVG event and TypeScript integration.
- Prettier, `git diff --check`, and final status review.

## Experience Signal

The existing interaction layer used logical symbol viewBoxes as pointer targets
and began mutable gestures at pointer-down. This is a candidate product
interaction lesson only if the human later asks to extract it.

## Commit Intent

```text
fix(editor): make component selection less error-prone
```
