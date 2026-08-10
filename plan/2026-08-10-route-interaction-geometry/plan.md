# Route Interaction Geometry

## Goal

Extract the pure route, endpoint, annotation-anchor, label-hit, and direct-pin
snap calculations from the App component closure. Establish a reusable geometry
boundary that later route/drag controllers can depend on without importing App.

## Dirty-State Decision

Editor architecture work through recovery commit `1a17c2b` is committed. The
remaining dirty documentation, archive, spec, reference, shared log, and
documentation-cleanup plan remain unrelated and read-only.

## Owned Files

- `apps/editor/src/App.tsx`: remove the extracted pure helpers and supply their
  explicit dependencies at call sites
- `apps/editor/src/canvas-geometry.ts`
- `apps/editor/src/route-interaction-geometry.ts`
- `apps/editor/src/route-interaction-geometry.test.ts`
- `plan/2026-08-10-route-interaction-geometry/plan.md`

## Read-Only Files

- Existing unrelated dirty paths and `plan/log.md`
- Model, derived, render-svg, symbol, and edit-engine packages
- Existing selection-geometry module and tests

## Shared Dependencies

- Geometry helpers are read-only and never emit or commit edits.
- Route polyline resolution remains the derived package's responsibility.
- Both legacy `routeAttachment` and canonical route `VisualAnchor` remain
  readable during this structural extraction; no persisted contract changes.
- Annotation hit bounds must continue matching formal RichText layout and
  current-arrow placement.
- Direct pin snap keeps visibility, Net compatibility, radius, and whole-group
  translation behavior unchanged.

## Expected Work

1. Move scalar clamp and orthogonal closest-point primitives to a small canvas
   geometry module used by App and route calculations.
2. Extract endpoint Net lookup, loose-route detection, direct pin snap, nearest
   route attachment, route-marker compatibility, annotation anchor/hit box,
   instance hit box, and implicit instance label calculations.
3. Replace closure dependencies with explicit Document, resolver, polyline,
   style-profile, and visible-endpoint parameters.
4. Add focused pure tests for loose anchors, attachment compatibility and
   placement, implicit labels, and snap constraints.

## Validation

- Focused route geometry, selection geometry, and App unit tests
- Focused route stretch, loose wire, pin snap, label drag/edit, current arrow,
  and multi-select Playwright flows
- Full editor Vitest and Playwright suites
- `pnpm typecheck`, editor build, `git diff --check`, final status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): extract route interaction geometry
```

Shared `plan/log.md` remains deferred to its concurrent owner.

## Concurrent-State Audit

During final validation, another target added dirty CI, Playwright, test, plan
archive, and package-test paths. None overlaps this target's owned files.
`playwright.config.ts` changed only from spec-level serial execution to isolated
test-level parallelism; the full 59-scenario suite passed under that current
configuration. Those concurrent paths remain unstaged here.

## Outcome

- Added shared orthogonal clamp/closest-point canvas primitives.
- Extracted endpoint Net lookup, loose-route classification, direct visible-pin
  snap, nearest route attachment, route-marker compatibility, annotation
  anchor/hit bounds, instance hit bounds, and implicit instance labels into a
  pure route interaction geometry module.
- Replaced hidden closure dependencies with explicit Document, resolver,
  visible-endpoint, route-polyline, style-profile, and snap-radius parameters.
- Removed all corresponding helper implementations from App and added focused
  tests for free route anchors, nearest segment projection, canonical route
  VisualAnchor resolution, implicit-label suppression, and whole-group pin
  snap translation.
- Reduced `App.tsx` from 6,901 to 6,558 lines without changing edit emission,
  persisted geometry, route rendering, or hit behavior.

Validation completed on 2026-08-10:

- `pnpm typecheck`
- focused route/selection geometry and App Vitest — 17 tests passed
- focused route, pin snap, group move, label, and marker Playwright — 8 tests
  passed
- full `pnpm exec vitest run apps/editor/src` — 18 files, 70 tests passed
- full `pnpm exec playwright test` — 59 tests passed under current fully
  parallel configuration
- `pnpm --filter @icm/editor... build`
- `git diff --check`

The next structural target can build route and annotation event controllers on
this module or extract the similarly geometry-heavy drafting manipulation
controller.
