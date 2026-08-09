# Select before drag

## Goal

Replace the editor's one-gesture select-and-move behavior with a two-stage
interaction model: clicking an unselected component, annotation, or free
drafting object selects it only; moving it requires a new drag beginning on an
already selected object. Remove text hit padding. This prevents dense
schematics from moving arbitrary objects while preserving generous wire and
junction targeting.

## Dirty-State Note

The shared worktree contains uncommitted drafting-arrow geometry and inline
inspector work in `App.tsx`, `styles.css`, model, derived, and renderer files.
It is separately owned. The user explicitly requested this interaction target
to proceed now. This target owns only isolated selection/drag hunks in
`App.tsx`, the selection helper/test, its plan, and its log entry; it must not
alter or stage the drafting-arrow hunks.

## Owned Files

- `apps/editor/src/App.tsx` (selection/drag hunks only)
- `apps/editor/src/styles.css` (only `.hit-target` / `.annotation-hit` cursor
  rules; drafting-arrow inspector/handle rules remain read-only)
- `apps/editor/src/selection-geometry.ts`
- `apps/editor/src/selection-geometry.test.ts`
- `apps/editor/src/App.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-09-select-before-drag/plan.md`
- `plan/log.md` (this target's entry only)

## Read-Only Files

- all current drafting-arrow target files, including its inspector/handle CSS
- renderer/model/derived selection semantics
- route, endpoint, and junction hit targets

## Shared Dependencies

- Existing selected-object group move, connected-route stretch, annotation
  anchoring, and drafting-object transactions must remain unchanged after a
  permitted drag starts.
- Wire endpoint and route hit layers retain their current direct manipulation
  model because their geometry is intentionally thin.

## Expected Work

1. Add pure predicates describing whether an object is selected and whether a
   pointer-down may start a drag.
2. Gate component, explicit annotation, and free drafting drag startup on
   current selection. An unselected object is selected and the gesture exits
   without pointer capture or a move preview.
3. Set annotation text hit padding to zero; its measured RichText bounds remain
   the selection surface.
4. Preserve double-click editing and modifier selection behavior.
5. Treat attached instance/net/route labels exactly like components: a normal
   click selects the label itself, and a later drag moves it. Free text uses
   the same two-stage interaction.
6. Cover the interaction predicates and static editor affordances with focused
   tests, plus browser gestures proving first-drag-selects / second-drag-
   moves and attached-label host selection.
7. Remove deferred click-through from attached labels. It caused selection to
   flash from label to host on pointer-up and made text feel unlike every other
   selectable object.
8. Give text annotations the same transparent dashed selection outline as a
   component. Keep the broad highlighted hit-band treatment only for thin
   drafting lines and route markers, where it is needed for usability.

## Validation

- Focused selection-geometry and editor-shell Vitest, plus the select-before-
  drag Playwright case.
- Editor TypeScript check and production build.
- Prettier, `git diff --check`, and a final shared-worktree ownership review.

## Commit Intent

```text
fix(editor): require selection before object drag
```
