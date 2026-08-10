# Instance transform geometry follow

## Goal

Make instance move, rotate, and mirror edits preserve the visible attachment
contract: connected Route endpoints remain orthogonal and attached instance
annotations follow the instance's local geometry.

## Dirty-State Decision

The branch is ahead of its remote and has an active, unrelated editor/drafting
refactor. Its dirty files include `App.tsx`, model/drafting geometry, renderer,
and `derived/stretch.ts`. This target does not own or modify those files. The
Edit Engine transaction and routing test files are clean; the implementation is
therefore confined to the shared transaction boundary already consumed by GUI
and Agent edits.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-instance-transform-follow/plan.md`
- `plan/log.md`

## Read-Only Dependencies

- `packages/derived/src/stretch.ts`
- `packages/model/src/geometry.ts`
- `apps/editor/src/App.tsx`
- all currently dirty editor, model, derived, and renderer paths

## Expected Work

1. Calculate each instance transform from a pre-edit Document snapshot.
2. Apply one internal Route endpoint-follow routine for move, rotate, and
   mirror edits; preserve existing topology and orthogonal geometry.
3. Transform attached annotation positions through instance-local coordinates.
   Keep text glyphs readable instead of mirroring them.
4. Add exact move, rotate, mirror, Route, and annotation regressions.

## Validation

- Focused Edit Engine routing tests.
- Edit Engine build and workspace typecheck.
- `git diff --check` and final status audit.

## Commit Intent

```text
fix(edit-engine): follow instance transforms with routes and labels
```

## Outcome

- Fixed the move ordering defect: every transform now retains a snapshot from
  immediately before the edit, so terminal displacement is no longer computed
  after the instance has already moved.
- `move_instance`, `rotate_instance`, and `mirror_instance` now share one
  internal topology-preserving Route follow path.
- Manual Route endpoints stretch orthogonally. Escape endpoints rotate or
  mirror into the terminal's new outward direction and reconnect locally to the
  unchanged Route body.
- Attached annotation positions round-trip through instance-local coordinates.
  Their glyphs remain upright/readable rather than becoming mirrored text.
- All Edit Engine tests passed (45/45), including exact move/rotate/mirror
  geometry and rotated escape departure. The Edit Engine build and
  `git diff --check` passed.
- Workspace typecheck remains blocked by concurrent, unrelated dirty tests:
  two `inout` direction literals in `derived/stretch.test.ts` and stale
  `leadsPx` references in the Symbols catalog tests.
- `plan/log.md` already contains a contiguous, concurrently owned uncommitted
  block. This target records its factual outcome here rather than staging or
  rewriting another worker's log entries.
