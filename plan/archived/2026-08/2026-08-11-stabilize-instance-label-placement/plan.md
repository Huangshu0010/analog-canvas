---
status: completed
experience: none
---

# Stabilize default instance-label placement

## Goal

Reuse the existing annotation placement system for default instance labels so
newly added components keep a stable visual clearance through rotation, and
place NPN/PNP names with the same channel-side logic used by MOS symbols.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns only the derived default-label helper,
the transaction path that preserves labels when an instance rotates, focused
tests, and plan/log entries.

- `packages/derived/src/instance-label-placement.ts`
- `packages/edit-engine/src/transaction.ts`
- `apps/editor/src/features/wiring/route-interaction-geometry.test.ts`
- `packages/edit-engine/src/presentation.test.ts`
- `plan/2026-08-11-stabilize-instance-label-placement/plan.md`
- `plan/log.md`

Read-only: annotation schema, rendering/text composition, and all symbol
definitions. No annotation protocol or persisted schema will change.

## Work

1. Route all renderer-owned default instance-label positions through the
   existing upright annotation placement helper.
2. Recognize BJT D/G/S-equivalent roles (`base`, `collector`, `emitter`) and
   use the MOS channel-side placement rule.
3. Reuse the same helper during placement rotation, preserving explicit user
   labels and their attachment semantics.
4. Add regression coverage for BJT default orientation and rotation stability.

## Validation

- focused derived/editor/edit-engine tests
- TypeScript build for affected packages
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
fix(labels): stabilize default instance text placement
```

## Outcome

- Preserved the annotation model and used the existing upright annotation
  placement helper as the single default/rotation path for instance names.
- NPN and PNP are now recognized as active three-terminal devices and use the
  MOS channel-side name position, avoiding their base-side wiring.
- Default labels for ports, side-labelled passives/sources, and bottom-labelled
  blocks now use the same visible-bounds and glyph-baseline calculation across
  rotations. Existing explicit labels remain attached and editable; they are
  only repositioned through that same helper when their instance is moved,
  rotated, or mirrored.
- Added BJT placement and rotation regressions. Focused tests and affected
  package/editor builds pass.
