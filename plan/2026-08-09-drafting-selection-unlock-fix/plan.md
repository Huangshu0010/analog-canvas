# Drafting selection and unlock repair

## Goal

Make the persistent Selection shelf apply drawing-style changes reliably and
make a drafting-object lock reversible. Lock protects editing only; Delete
always has higher priority and removes a selected locked drafting object.

## Dirty-State Note

Start state from `git status --short --branch` on 2026-08-09:

```text
## feat/razavi-fidelity-diff-harness...origin/feat/razavi-fidelity-diff-harness [ahead 11]
 M apps/editor/e2e/drafting.spec.ts
 M apps/editor/e2e/manual-editor.spec.ts
 M apps/editor/src/App.test.tsx
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
 M packages/derived/src/drafting-geometry.test.ts
 M packages/derived/src/drafting-geometry.ts
 M packages/model/src/drafting-geometry-schema.ts
 M packages/model/src/schema.ts
 M packages/render-svg/src/render.ts
 M packages/spice/src/baseline.test.ts
 M packages/spice/src/importer.ts
 M plan/log.md
 ?? assorted unrelated plans, visual artifacts, and local scratch files
```

The dirty `App.tsx`, `styles.css`, and drafting E2E file are the just-finished
drafting target reported complete by the user. This repair takes ownership only
of narrow hunks for the Selection shelf's mutation/lock behavior; all other
dirty hunks remain untouched and will not be staged by this target.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/e2e/drafting.spec.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/drafting-render.test.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/drafting.test.ts`
- `plan/2026-08-09-drafting-selection-unlock-fix/plan.md`
- `plan/log.md`

## Read-Only Files

- `apps/editor/src/styles.css`
- `packages/model/src/schema.ts`

## Shared Dependencies

- `upsert_drafting_object` and `remove_drafting_object` transactions.
- `visualSelection.draftingIds`, which remains the single source of the shelf
  selection.
- `DraftingObject.locked`: lock blocks in-place editing but not selection,
  Unlock, or Delete.

## Expected Work

1. Make the renderer consume the style-override line style written by the
   shelf, with the object's original line style as the fallback.
2. Audit the shelf's selected-object and style-transaction path; preserve
   selection across each successful style update.
3. Make both construction lines and free arrows render the line-style override
   written by the shelf.
4. Permit only a pure `locked: true → false` replacement through the edit
   engine; all other changes to a locked object remain rejected.
5. Replace one-way Lock with an explicit Lock/Unlock toggle and clear status.
6. Permit deletion even while locked; lock blocks only in-place editing.
7. Add focused transaction and browser regressions covering shelf mutation,
   lock, unlock, and
   delete.
8. Assert the rendered SVG attributes for free-arrow shaft width and head size
   so future UI changes cannot silently turn their controls into no-ops.
9. Correct the numeric style-scale schema and rebuild its workspace consumers;
   `z.enum()` accepts string enums only and must not gate numeric controls.
10. End every free-arrow shaft at its head base plane, then assert the
    tip/base/shaft geometry so the shaft can never cover the arrowhead.

## Validation

- Focused Playwright drafting regression for the new behavior.
- `pnpm --filter @icm/editor build` for React/TypeScript integration.
- `git diff --check` and `git status --short --branch`.

The feature is an editor-only interaction that writes existing drafting
transactions, so a focused UI regression plus the editor build covers its
primary risk without a full workspace run.

## Result

- Construction lines and free arrows now honor `styleOverride.lineStyle`, so
  the Selection shelf changes visible SVG output rather than only persisted
  JSON.
- Lock is a visible state: editable controls disable while locked, the action
  becomes Unlock, and the shelf explains that editing is disabled.
- The edit engine accepts only a pure unlock replacement. Any geometry, style,
  or other payload change bundled with an unlock remains rejected.
- Deletion intentionally bypasses object-level drafting locks; Delete removes a
  locked selection immediately.
- Numeric scale fields now use a Zod numeric-literal union rather than an
  invalid numeric `z.enum`; workspace consumers were rebuilt.
- Free-arrow shafts now end at the head base plane; headless arrows remain
  full-length lines.
- The focused engine test (10/10), focused Drawing-shelf Playwright test (4/4),
  Editor production build, source/target-plan Prettier checks, and
  `git diff --check` passed. The shared dirty `plan/log.md` has a pre-existing
  Markdown Prettier warning and was not reformatted wholesale.
- The full drafting Playwright file was started but exceeded the local 120 s
  command budget without producing a completed report; it is not counted as a
  passing validation.
- The duplicate local Vite processes were replaced with one rebuilt editor
  server at `http://localhost:5173`.

## Experience Signal (for human review)

None for this routine repair.

## Commit Intent

```text
fix(editor): make drafting locks reversible
```
