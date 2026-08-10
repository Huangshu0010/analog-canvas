# Drafting Floating Controls Cleanup

## Goal

Use the canvas floating inspectors as the single editing surface for free arrows,
construction lines, and text. Remove duplicate or unexplained controls, keep the
inspectors contained, and make free text follow the same Razavi typography and
dashed selection treatment as schematic annotations.

## Dirty-State Decision

The worktree contains concurrent unified canvas-drag-session and
topology-aware route-stretch work in `App.tsx`, drafting/manual browser tests,
selection geometry, Derived, the interaction specification, and their plans.
The user explicitly requested this overlapping UI cleanup. This target owns
only the Selection Drawing JSX, drafting floating-inspector JSX/layout CSS, text
editor containment CSS, and focused drafting browser assertions. All pointer
session, route geometry, selection geometry, Derived, and specification hunks
remain read-only and unstaged.

## Owned Paths and Hunks

- `apps/editor/src/App.tsx`: Selection Drawing section and floating drafting/text
  inspector presentation, free-text creation, and text shortcut only
- `apps/editor/src/rich-text-editor.tsx`: text toolbar and live edit preview only
- `apps/editor/src/styles.css`: floating drafting/text editor containment only
- `apps/editor/e2e/drafting.spec.ts`: focused control-surface and overflow tests
- `apps/editor/e2e/chrome-isolation.spec.ts`: Help dismissal regression only
- `plan/2026-08-10-drafting-floating-controls/plan.md`
- `plan/log.md`: this target's factual entry only

## Shared Dependencies

- Existing typed `setDraftingStyle`, rotate, reverse, tangent, bearing, and lock
  operations remain unchanged.
- The Selection shelf remains available for all non-drafting properties and
  summary state; only the duplicate free-arrow/construction-line editor is
  removed.
- `foreignObject` dimensions and viewBox clamping are editor-only and must not
  affect formal SVG/export geometry.

## Expected Work

1. Remove the Selection `Drawing style` action section.
2. Preserve lock/unlock by exposing it in the floating drafting inspector.
3. Show the per-segment selector only for multi-segment construction lines,
   never for arrows.
4. Give the arrow inspector deterministic two-column sizing and clamp it within
   the viewBox; keep the slightly wider rich-text toolbar on one contained row.
5. Add focused browser coverage for single-surface controls, absent arrow
   Segment selector, and `foreignObject` containment.
6. Make Escape and outside-canvas pointer gestures close active text and
   drafting floats without requiring Apply/Delete, while preserving menu-based
   commands for a selected drawing.
7. Stabilize the header as symmetric title/commands/status columns so status
   text changes cannot move the command bar.
8. Include the remaining active modal surface in the dismissal audit: Help
   closes on backdrop pointer-down as well as Escape.
9. Remove the fraction insertion mode while retaining compatibility rendering
   for already-saved fraction runs.
10. Reflect size changes inside the active editable field before Apply.
11. Create free text with the Razavi label typography token and use the same
    precise dashed selection rectangle as annotation text.
12. Add `T` as the free-text shortcut and expose it in Draw and Help.

## Validation

- Focused drafting Playwright scenarios for arrow, construction-line, text, and
  lock behavior, including live text size, absent fraction insertion, Razavi
  defaults, dashed text selection, and the `T` shortcut
- `pnpm exec vitest run apps/editor/src/App.test.tsx`
- editor dependency build and editor production build
- owned-file formatting, `git diff --check`, and dirty-state review

## Commit Intent

Commit separately as `fix(editor): consolidate drafting floating controls` only
when the concurrent shared-file work is ready for an exact-hunk commit.

## Outcome

- Removed the Selection-shelf `Drawing style` section. The shelf continues to
  show selection summary and unrelated property surfaces.
- Kept every drafting operation in the floating inspector, including moving
  Lock/Unlock there and retaining arrow-head size.
- Restricted `Curve segment` to multi-segment construction lines; arrows no
  longer expose it. Direct curve handles still select the relevant arrow
  segment internally for tangent editing.
- The arrow inspector now uses a contained two-column grid with dimensions and
  viewBox clamping based on its actual height. The text editor is viewBox
  clamped and now reserves 420 logical units for a single-row toolbar.
- Text editing closes without committing on Escape or any pointer-down outside
  its `foreignObject`. Arrow/construction floats close on Escape or a canvas
  pointer outside their selected geometry/handles, while header menus can still
  operate on the selection. Help now closes on Escape or its backdrop.
- The header uses symmetric grid columns for title, commands, and status. A
  browser assertion changes status through a drafting style transaction and
  proves the command bar rectangle is unchanged.
- Focused Playwright passed 5/5 and measures child `scrollWidth`/`scrollHeight`
  plus every immediate child rectangle against the owning `foreignObject`.
  App Vitest passed 11/11, all editor dependencies and the production editor
  built, owned files pass Prettier, and `git diff --check` passes.
- The complete drafting browser file passed 14/18. Its four failures are outside
  this target: the retired Export menu selector, an already-ambiguous duplicate
  status-text locator, and two concurrent drag-session/vertex gesture cases.
  All five new or migrated control-surface scenarios passed in both focused and
  full runs.
- Follow-up browser coverage passes 8/8 for single-row text layout, geometric
  containment, text/drafting Escape and outside-pointer dismissal, Selection
  de-duplication, Help dismissal, and status-independent command positioning.
- Removed fraction insertion from the toolbar while preserving compatibility
  parsing/rendering for fraction runs already stored in project files. Text-size
  steps now update the editable field immediately before Apply.
- New free text explicitly uses the `label` typography token. Both the editor
  and every canvas `<text>` use the canonical DejaVu/Razavi font stack, closing
  the previous leak from the surrounding Inter UI. Free-text selection now uses
  the same precise blue `6 4` dashed rectangle as annotation text.
- Added `T` for immediate free-text creation and documented it in Draw and Help.
- Three focused text Playwright scenarios pass, including live size preview,
  absent fraction insertion, Razavi font use before and after Apply, dashed
  selection, shortcut creation, and rich-text save/reopen. App Vitest passes
  11/11, the editor dependency/build chain passes, and owned-file formatting
  plus `git diff --check` pass. Root typecheck remains blocked by unrelated dirty
  test fixtures (`inout` direction values and missing symbol-catalog `leadsPx`).
- Commit remains intentionally pending because `App.tsx` and
  `drafting.spec.ts` also contain uncommitted, separately owned drag-session
  changes and the branch is already ahead with external commits.
