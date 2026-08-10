# Attached text orientation follow

## Goal

Complete instance annotation following by transforming the annotation baseline
direction as well as its position during rotate and mirror edits.

## Dirty-State Decision

Concurrent editor/drafting work remains dirty, including shared model and
renderer files. This follow-up owns only the currently clean Edit Engine
transaction and routing regression files. All unrelated dirty paths remain
untouched and unstaged.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-attached-text-orientation-follow/plan.md`

## Read-Only Dependencies

- `packages/model/src/geometry.ts`
- `packages/model/src/schema.ts`
- `packages/render-svg/src/render.ts`
- `plan/log.md` (concurrently owned dirty block)

## Expected Work

1. Convert the annotation's world-space baseline direction into the old
   instance-local orientation.
2. Transform that direction through the new instance orientation and persist
   the resulting quarter-turn annotation rotation.
3. Assert exact direction after move, rotate, and mirror.

## Validation

- Focused and complete Edit Engine tests.
- Edit Engine build and editor App unit tests.
- `git diff --check`.

## Commit Intent

```text
fix(edit-engine): rotate attached text with instances
```

## Outcome

- Attached annotations now transform both their anchor position and baseline
  direction through the old and new instance orientations.
- Move preserves the existing text rotation; a 90-degree instance rotation
  advances the annotation to 90 degrees; mirroring that rotated instance maps
  the annotation direction to 270 degrees.
- The persisted value remains a schema-valid quarter turn, so renderer and hit
  geometry consume the same orientation without a second GUI-only rule.
- Routing tests passed 12/12, all Edit Engine tests passed 45/45, the Edit
  Engine build passed, editor App tests passed 11/11, and `git diff --check`
  passed.
- `plan/log.md` remains an overlapping concurrently owned dirty file, so this
  follow-up records its factual result here without staging other work.
