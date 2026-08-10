# Upright transformed instance labels

## Goal

Keep instance labels upright after component rotation/mirroring while moving
their anchors to the corresponding transformed side with clear visual spacing.

## Dirty-State Decision

Concurrent editor, model, renderer, derived, documentation, and E2E work
remains dirty. This follow-up owns only the clean Edit Engine transaction and
routing test files plus this plan. It does not stage or rewrite the dirty
`plan/log.md` block.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-upright-transformed-instance-labels/plan.md`

## Read-Only Dependencies

- `packages/model/src/schema.ts`
- `packages/symbols/src/schema.ts`
- `packages/render-svg/src/default-instance-label-placement.ts`
- all unrelated dirty paths

## Expected Work

1. Preserve an attached instance label's local side across orientation changes.
2. On rotate/mirror, enforce at least two connection grids of clearance beyond
   the corresponding symbol viewBox edge.
3. Persist `rotation: 0` and recompute start/middle/end alignment from the new
   world-space side. Pure moves retain the existing authored spacing.
4. Keep the legacy orientation transform for non-instance-label annotations.

## Validation

- Focused and complete Edit Engine tests.
- Edit Engine build and editor App unit tests.
- `git diff --check`.

## Commit Intent

```text
fix(edit-engine): keep transformed instance labels upright
```

## Outcome

- Pure moves preserve the authored local label position and distance.
- Rotate/mirror transforms retain the label's selected local side, then enforce
  at least two presentation grids of clearance beyond the symbol viewBox edge.
- Instance-label text is persisted upright at `rotation: 0`; alignment is
  recomputed as start/end/middle from its new world-space side.
- `offset` is synchronized with the resulting position so later editor drags
  and hit geometry do not observe stale attachment data.
- Non-instance-label annotations retain the orientation-follow behavior needed
  for directional markers.
- Routing tests passed 12/12, all Edit Engine tests passed 45/45, the Edit
  Engine build passed, editor App tests passed 11/11, and `git diff --check`
  passed.
- `plan/log.md` remains an overlapping concurrently owned dirty file; this
  target records its result here without staging that work.
