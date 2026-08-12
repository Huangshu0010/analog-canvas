---
status: completed
experience: none
---

# WP-R4 — Route-Tap Planner Extraction (App thin-out, step 1)

## Goal

Begin the WP-R4 App thin-out (roadmap §8 R4) with the safest, fully testable
piece: extract the route-tap hit resolver currently inlined in `App.tsx`
(`resolveRouteTap`, lines 304–384) into a pure, unit-tested wiring-feature
module, and rewire `App.tsx` to import it. This moves one concrete piece of
session/hit logic out of the 6941-line `App.tsx` — the roadmap names "route tap"
explicitly — and establishes the extraction pattern.

The remaining stretch / group-move wrapper extractions assemble Edit Engine
transactions and are not covered by unit tests today; per roadmap §13
(one-consumer-at-a-time, e2e-gated) they are deferred to the WP-R10 consumer
migration rather than changed blind here.

## Why this scope is safe

`resolveRouteTap` is a pure function `(points, pointer, tolerance) → RouteTap |
null`. It has no App-state dependency. `App.test.tsx` has zero coverage of the
tap flow, so an extraction is validated by (a) verbatim move of a pure function,
(b) comprehensive unit tests for the new module, (c) `App.test.tsx` still
passing, and (d) typecheck. The function body is copied unchanged; only its
home changes.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0/R1/R2/R3 committed)
```

Owned paths:

- `apps/editor/src/features/wiring/route-tap.ts` (NEW — verbatim extraction +
  `RouteTap` type)
- `apps/editor/src/features/wiring/route-tap.test.ts` (NEW — unit tests)
- `apps/editor/src/app/App.tsx` (remove local `RouteTap` + `resolveRouteTap`;
  add import — behavior-preserving)
- `plan/2026-08-12-wp-r4-route-tap-extraction/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: the rest of `App.tsx` (only the two `resolveRouteTap` call sites at
~1393 and ~1417 remain; they now resolve via the import).

Shared: `resolveRouteTap`'s behavior is the existing screen-tolerance tap
contract; the extraction must not change it.

## Work

1. `route-tap.ts`: export `interface RouteTap { segmentIndex; point;
   distanceSquared }` and `resolveRouteTap(points, pointer, tolerance)` copied
   verbatim from `App.tsx:304–384`. Import `Point` from `@icm/model`.
2. `route-tap.test.ts`: cover (a) interior-vertex preference over segment
   projection near a bend; (b) projection onto a horizontal and a vertical
   segment clamped to the segment bounds; (c) out-of-tolerance pointer returns
   null; (d) tie-break by lower segment index; (e) diagonal segment skipped.
3. `App.tsx`: delete the local `RouteTap` interface and `resolveRouteTap`
   function; add `import { resolveRouteTap, type RouteTap } from
   "../features/wiring/route-tap";`.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run apps/editor/src/features/wiring/route-tap.test.ts` (new
  tests)
- `pnpm exec vitest run apps/editor/src/app/App.test.tsx` (existing App tests
  still pass — confirms the import rewire compiles and nothing regressions)
- `pnpm exec prettier --check` on the new `.ts`/`.tsx` files and the App edit
- `git diff --check`

Scope rationale: behavior-preserving extraction of one pure helper; the new
module's unit tests plus App's existing test file plus workspace typecheck are
the smallest deterministic set that proves behavior is unchanged.

## Commit Intent

```text
refactor(editor): extract route-tap resolver from App into wiring feature (WP-R4)
```

## Outcome

Extracted the `resolveRouteTap` route-tap hit resolver (and its `RouteTap` type)
out of `App.tsx` (was lines 304–384) into a pure, unit-tested wiring-feature
module, and rewired `App.tsx` to import it. Behavior-preserving. This is step 1
of the WP-R4 App thin-out: one concrete piece of session/hit logic named by the
roadmap ("route tap") is now testable and reusable independently of the App
component.

- `apps/editor/src/features/wiring/route-tap.ts`: `RouteTap` interface +
  `resolveRouteTap` copied verbatim.
- `apps/editor/src/features/wiring/route-tap.test.ts` (6 tests): interior-
  vertex preference over a closer segment projection, horizontal/vertical
  projection clamped to bounds, endpoint clamp past the end, distance tie-break
  by lower segment index, diagonal-segment skip.
- `apps/editor/src/app/App.tsx`: local `RouteTap` + `resolveRouteTap` removed;
  imported from the new module.

Deferred to WP-R10 (e2e-gated): the `completeRouteStretch` and group-move
wrappers also inlined in `App.tsx` assemble Edit Engine transactions and are
not covered by unit tests today. Per roadmap §13 (one-consumer-at-a-time,
e2e-gated) they are migrated in R10 rather than changed blind here.

Validation: workspace `pnpm typecheck` passed; `vitest run` on
`route-tap.test.ts` (6) and `App.test.tsx` (11) passed; `prettier --check` on
the changed `.ts`/`.tsx` files passed; `git diff --check` clean.

`status: completed`, `experience: none`.
