# Razavi current annotation, source, and port reference calibration

## Goal

Archive the user-provided raster as supplementary evidence under the existing
sole Razavi visual authority, measure its route-current arrow, current source,
and hollow Port geometry, then make the smallest geometry/rendering changes
needed to align those three primitives.

## Dirty-state decision

`git status --short --branch` reports a clean tracked worktree on
`feat/razavi-fidelity-diff-harness`. The pre-existing untracked bandpass
exports, unrelated plan directories, and `probe-conflicts.mjs` are not owned by
this target and do not overlap its paths. They will not be modified, staged,
or deleted.

## Ownership

Owned paths:

- `fixtures/visual-reference/razavi-reference-v1/current-port-reference.png`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `fixtures/visual-reference/razavi-reference-v1/current-port-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `scripts/generate-razavi-peripheral-assets.mjs`
- `scripts/razavi-fidelity-diff.mjs` and narrowly related fidelity helpers/tests
- generated Razavi peripheral/catalog artifacts required by the generator
- focused renderer tests for hollow Port output
- `plan/2026-08-09-razavi-current-port-reference/`
- `plan/log.md`

Read-only dependencies:

- user attachment at `C:\\Users\\90590\\AppData\\Local\\Temp\\codex-clipboard-e32143b0-8c68-45a0-9f4e-6a0523a3f49f.png`
- the existing sole reference raster and its MOS/passive geometry fixtures
- Symbol DSL/runtime renderer contracts outside the focused Port output change

## Work

1. Copy the supplied screenshot verbatim into the reference fixture and
   manifest-lock its digest; it remains supplementary evidence, not a second
   visual authority.
2. Record pixel measurements for route current arrows, the compact current
   source, and hollow Ports.
3. Extend the comparison fixture/harness only where it can score the actual
   rendered primitive, then iteratively adjust proven geometry.
4. Change formal Port origins from filled to hollow circles, per the latest
   reference and request, with a focused regression test.

## Validation

- Run the peripheral generator and build its affected package(s).
- Run focused fidelity comparisons for each of the three primitives.
- Run focused renderer tests for Port origin markup.
- Run `git diff --check` and inspect final `git status --short --branch`.

## Commit intent

One focused commit containing the supplementary reference evidence, measured
geometry, implementation, generator output, focused tests, and factual log.

## Result

- Archived the supplied 326 x 254 PNG verbatim and SHA-256 pinned it in the
  existing sole-authority manifest. `current-port-geometry.json` captures a
  5 px outside Port radius with a 2 px outline, the compact current-source
  crop, and route-marker head measurements.
- Formal Razavi Ports are now white-filled, normal-stroke hollow circles. The
  path radius is reduced by half the outline width so their outside radius
  remains equal to a filled 6.5 px junction.
- A route current marker now contributes only the triangular head: the attached
  route is its shaft. The head was lengthened and narrowed from the measured
  evidence to avoid the fixed-shaft stub on short or vertical routes.
- The compact current-source trial that lengthened its internal arrow reduced
  binary/soft IoU from `0.6087/0.5597` to `0.5897/0.5262`; it was reverted.
  The retained source score is anti-alias sensitive with a +0.220 registration
  lift, so it is evidence against further blind geometry tuning rather than an
  absolute acceptance gate.

## Actual-render fidelity completion

- The fidelity harness now rasterizes the actual formal SVG for a hollow Port
  and a route-attached current marker; neither uses a parallel drawing formula.
- Port scoring improved from `0.6232/0.5245` to `0.6393/0.6013`. The next
  smaller radius scored `0.5238/0.5155` and was rejected.
- Route-current-arrow scoring is `0.5947/0.6199`. Removing accidental test
  endpoint dots improved it from `0.5663/0.5902`; a longer head scored
  `0.5679/0.5683` and was rejected.
- Derived and Render-SVG were rebuilt. The running Vite GUI at
  `http://127.0.0.1:5173` serves the current source tree.

## Validation result

- `node scripts/generate-razavi-peripheral-assets.mjs` — passed.
- `node scripts/generate-razavi-symbol-catalog.mjs` — passed.
- Symbols, Derived, and Render-SVG builds — passed.
- `node scripts/razavi-fidelity-diff.mjs current-source-compact` — completed:
  `0.6087` binary IoU, `0.5597` soft IoU.
- `corepack pnpm exec vitest run packages/render-svg/src/render.test.ts -t
"Razavi current arrow|hollow node"` — 2 passed.
- The full render test file retains three pre-existing failures caused by stale
  MOS golden fixtures; this target neither changed MOS geometry nor rewrote
  unrelated goldens.
- `git diff --check` — passed.
