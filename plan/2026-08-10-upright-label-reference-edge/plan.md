# Upright label reference edge

## Goal

Preserve the authored `1.5`-unit visual gap after an instance label changes
side while remaining upright, using the glyph edge rather than the SVG text
baseline as the vertical reference.

## Dirty-State Decision

Unrelated editor/drafting work remains dirty. This target owns only the clean
Edit Engine transaction and routing regression files plus this plan. It reads
the symbol resolver and style-profile contracts without modifying their dirty
consumers.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-upright-label-reference-edge/plan.md`

## Expected Work

1. Identify the label's authored reference side and exact gap in the old symbol
   local coordinate system.
2. Transform that side through the new instance orientation.
3. For left/right, retain the ordinary text-anchor gap. For top/bottom, convert
   the same gap from glyph edge to upright SVG baseline using active typography.
4. Keep the label upright and recompute alignment/offset.

## Validation

- Exact top/bottom edge and baseline assertions.
- Complete Edit Engine tests/build and editor App unit tests.
- `git diff --check`.

## Commit Intent

```text
fix(edit-engine): place upright labels from the correct edge
```

## Outcome

- Label-side detection now ignores tangential points merely lying on another
  viewBox edge; only a position strictly outside an edge can select that edge.
- Left/right labels preserve the authored anchor-to-edge gap. Top labels use
  the upright glyph bottom and bottom labels use the upright glyph top, with
  active instance font size and `sizeScale` included in baseline conversion.
- `offset` retains the unmodified semantic anchor while `position` stores the
  displayed SVG baseline. Repeated rotate/mirror operations therefore do not
  accumulate font-height compensation as extra distance.
- The regression covers move, 90-degree rotation, and the corresponding
  mirrored/270-degree side with exact positions, offsets, and alignments.
- All Edit Engine tests passed (45/45), the Edit Engine build passed, editor App
  tests passed (11/11), and `git diff --check` passed.
- `plan/log.md` remains concurrently dirty and was not staged.
