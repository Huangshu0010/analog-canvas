# Net-label Route follow

## Goal

Make a `net-label` placed on a wire follow that Route when the wire is moved,
stretched, or reshaped through any Edit Engine transaction.

## Dirty-State Decision

Concurrent editor/drafting/visual-contract work remains dirty. This target
owns only the clean Edit Engine transaction and routing regression files plus
this plan. No GUI, model, renderer, or shared-log dirty file is modified.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-net-label-route-follow/plan.md`

## Shared Contract

- No schema or endpoint is added.
- `attachedObjectId` remains the electrical Net identity.
- Route/segment/t/normal information is a transaction-local derived anchor,
  not persisted Layout Intent or a second annotation protocol.

## Expected Work

1. Capture the closest matching Route segment, interpolation, signed normal
   offset, and arc-length fraction for each existing net label.
2. After edits, move only labels whose captured Route geometry changed.
3. Preserve the same segment/t when segment count is stable; use arc fraction
   when normalization inserts/removes bends.
4. Do not overwrite a label explicitly edited in the same transaction.

## Validation

- Exact Route reshape and net-label follow regression.
- Complete Edit Engine tests/build and editor App unit tests.
- `git diff --check`.

## Commit Intent

```text
fix(edit-engine): move net labels with route geometry
```

## Outcome

- Net labels now derive a transient attachment from the nearest Route of their
  attached Net before a transaction changes geometry.
- Stable segment structures preserve segment index and interpolation; changed
  structures fall back to arc-length fraction. Both paths preserve signed
  perpendicular clearance from the wire.
- Labels explicitly edited in the same transaction are not overwritten.
- No model, API, or persisted annotation shape changed.
- Validation passed: Edit Engine 46/46 tests, package build, editor App 11/11
  tests, and `git diff --check`.
- `plan/log.md` was already modified by concurrent work, so this target did not
  edit that shared dirty file; this plan is the durable factual record.
