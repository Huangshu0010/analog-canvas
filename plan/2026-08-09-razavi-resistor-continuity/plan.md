# Razavi resistor continuity

## Goal

Align the reviewed Razavi resistor with its raster authority: sharp zig-zag
corners and seamless body-to-lead joins, without moving either electrical pin.

## Dirty-State Decision

The starting branch is `codex/optimize-iteration`. `catalog.json`, generated
catalog output, PMOS assets, the MOS generator, and catalog tests are dirty
from concurrent MOS-body work. The resistor asset and its measured reference
are clean. This target may touch only the non-overlapping resistor catalog and
test hunks; it will inspect generated diffs before staging and will never
stage, revert, or alter PMOS/MOS-generator hunks.

## Owned Files

- `packages/symbols/assets/razavi-v1/resistor.symbol.json`
- resistor hash hunk in `packages/symbols/assets/razavi-v1/catalog.json`
- resistor runtime hunk in `packages/symbols/src/razavi-catalog.generated.ts`
- resistor-focused assertions in `packages/symbols/src/razavi-catalog.test.ts`
- `scripts/razavi-fidelity-diff.mjs` only to correct its option-value parsing
- this plan and the factual `plan/log.md` entry

## Read-Only Files

- `fixtures/visual-reference/razavi-reference-v1/passive-geometry.json`
- PMOS assets, MOS generator, all netlists, and `lib/circuit.vss`

## Work

Replace the separate resistor body path and two butt-ended leads with one
continuous miter-joined path from pin 1 through the measured zig-zag body to
pin 2. Preserve the body vertices, pins, stroke role, and rotation behavior.

## Progress

- The asset now has one path from `(0,-20)` through every measured body vertex
  to `(0,20)`, with `lineJoin: miter`; the former three independent primitives
  are removed.
- Fixed fidelity CLI option parsing so `--out <directory>` is not interpreted
  as a device. The resistor comparison reports IoU 0.6613, registration lift
  0.000, and a 100% anti-alias edge residual.

## Validation

- `node scripts/generate-razavi-symbol-catalog.mjs`
- focused resistor fidelity comparison (including option-value parsing)
- focused catalog Vitest and Symbols/Editor builds
- `git diff --check`; inspect the staged diff to confirm only resistor hunks

## Commit Intent

`fix(razavi): join resistor body and leads`
