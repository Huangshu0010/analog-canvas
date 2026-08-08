# Precise Device Hit Targets and Explicit Text Markup

## Goal

Prevent device selection from masking nearby routing interactions, and make
subscript/italic mathematical labels authorable from the Text panel.

## Dirty-State Decision

The uncommitted editor changes in `apps/editor/src/App.tsx` belong to the
immediately preceding Razavi-default target and are owned by this workstream.
The unrelated untracked CDAC and agent-guidance plans remain read-only. This
target extends the owned editor surface and adds renderer-only text parsing.

## Owned Files

- `plan/2026-08-08-precise-hit-targets-and-text-markup/plan.md`
- `apps/editor/src/App.tsx` and `apps/editor/src/styles.css`
- `packages/render-svg/src/schematic-text.ts` and focused render tests
- `plan/log.md`

## Expected Work

1. Replace the fixed-radius device hit circle with a padded, transformed
   Symbol viewBox rectangle.
2. Support explicit `V_{DD}`/`M_{1}` subscripts and `\\it{gain}` italic text
   in Razavi rendering, including plain text annotations.
3. Add selection-aware Text-panel buttons to insert subscript and italic
   markup, plus compact syntax guidance.

## Validation

- focused renderer text tests and editor build
- typecheck where concurrent workspace state permits
- `git diff --check`

## Commit Intent

Leave the change uncommitted while the adjacent style-default target remains
uncommitted.

## Outcome

- Device interaction now uses the transformed bounds of each resolved Symbol
  definition, padded by three canvas units, instead of a fixed 36-unit radius
  circle. Endpoint handles retain their later overlay order.
- Explicit markup works in Razavi text for every annotation kind, including
  plain text: `M_{1}`/`V_{DD}` produce mathematical subscripts and
  `\\it{gain}` produces italic text.
- The Text panel preserves selection while inserting subscript or italic
  markup through `xₐ` and `Italic` buttons, and displays a syntax example.

## Validation Record

- Passed: renderer, model, and Edit Engine focused suites (25 tests), editor
  production build, renderer package build, and `git diff --check`.
- Workspace typecheck remains blocked by the concurrent unrelated missing
  return in `packages/agent-adapter/src/service.ts:437`.
