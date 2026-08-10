---
status: completed
experience: none
---

# MOS label visible-boundary rotation

## Goal

Prevent upright NMOS/PMOS instance labels from overlapping the transistor at
90/270 degrees by using the active symbol variant's visible geometry and the
text glyph edge, not the padded definition viewBox or raw SVG baseline.

## State and Ownership

Start state:

```text
## agent/fix-ci-baseline...origin/agent/fix-ci-baseline
```

The worktree is clean. This is a focused follow-up on the current branch. It
owns the shared placement geometry, its render/edit consumers and regressions,
this plan, and its factual log entry.

- `packages/derived/src/instance-label-placement.ts`
- `packages/derived/src/index.ts`
- `packages/derived/src/visual.ts`
- `packages/render-svg/src/default-instance-label-placement.ts`
- `packages/render-svg/src/default-instance-label-placement.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/route-interaction-geometry.ts`
- `apps/editor/src/route-interaction-geometry.test.ts`
- `plan/2026-08-10-mos-label-visible-boundary/plan.md`
- `plan/log.md`

Read-only shared dependencies are the model Annotation schema, Symbol DSL, and
typed edit union. No persisted field or API edit kind changes.

## Work

1. Expose deterministic local visible-symbol bounds that respect hidden variant
   parts and pins.
2. Add one shared upright-label placement function using semantic side, visible
   bounds, authored clearance, and font ascent/descent compensation.
3. Route both renderer defaults and explicit Annotation rotation through that
   function for MOS symbols.
4. Cover all MOS forms and four orientations, including no-overlap assertions.

## Validation

- focused Derived, Render SVG, and Edit Engine Vitest suites
- `pnpm --filter @icm/derived build`
- `pnpm --filter @icm/render-svg build`
- `pnpm --filter @icm/edit-engine build`
- `pnpm typecheck`
- local-browser visible bounds at 0/90/180/270 degrees
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(render): place rotated mos labels outside visible symbols
```

## Outcome

- Added one Derived placement authority shared by renderer defaults, editor
  materialization, and Edit Engine rotation. It separates semantic transform
  position from the painted upright SVG baseline.
- Visible symbol bounds now respect the active variant's hidden parts, added
  primitives, and hidden pins. MOS top/bottom placement uses glyph ascent and
  descent compensation against those bounds; left/right placement uses the
  same authored clearance and alignment.
- Explicit and implicit NMOS/PMOS labels now use identical geometry. The
  persisted offset remains the semantic anchor while `position` remains the
  painted baseline, so materializing a label no longer changes later rotation.
- Validation passed: 90 focused tests, Derived/Render/Edit Engine builds,
  repository typecheck, and `git diff --check`. Local-browser measurement of a
  materialized textbook NMOS at 0/90/180/270 degrees reported no symbol/text
  rectangle overlap in all four orientations.
