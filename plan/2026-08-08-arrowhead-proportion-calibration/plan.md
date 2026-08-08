# Arrowhead Proportion Calibration Plan

## Goal

Increase the Razavi MOS source-arrow width by 20%, and increase the Razavi
independent-current-source arrowhead length by 30% and width by 15%, without
changing symbol pins, source stems, electrical semantics, or MOS arrow hosts.

## Dirty-State Decision

The worktree contains active concurrent changes in the editor, model, renderer,
symbols, fixtures, and prior target plans. This target intentionally overlaps
the currently dirty, generator-owned Razavi MOS/core-analog asset paths because
the requested calibration is a direct continuation of their visual work. It
will edit only the source generators and their generated outputs; all other
dirty paths remain read-only.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- `scripts/generate-visio-core-analog-assets.mjs`
- generated Razavi MOS/current-source assets and catalog/visual goldens changed
  by the existing generator commands
- `packages/symbols/src/razavi-catalog.test.ts` (the existing exact current
  source-arrow regression assertion)
- `plan/2026-08-08-arrowhead-proportion-calibration/plan.md`
- `plan/log.md`

## Read-Only Dependencies

- Symbol DSL schemas and renderers
- existing Razavi catalog tests and generator check commands
- all non-arrow visual/editor/model changes

## Expected Work

1. Locate the generator-owned geometry for MOS and independent-current-source
   heads.
2. Apply only the requested scale factors, preserving head tips and all pin
   anchors/shafts.
3. Update the exact geometric regression assertion, regenerate owned
   assets/catalog/fidelity output, and run focused checks.

## Validation

- [x] Generator checks for MOS and core analog assets.
- [x] Focused symbol/catalog tests affected by regeneration (20 tests passed).
- [x] `git diff --check` and `git status --short --branch`.

## Outcome

- The source generators now preserve all anchors and arrow shafts while using
  MOS head width ×1.20, independent-current-source head length ×1.30, and
  independent-current-source head width ×1.15.
- Generator output was concurrently committed in `16ed903`; this target adds
  the precise catalog regression assertion for those final coordinates.

## Commit Intent

```text
style(razavi): calibrate MOS and current-source arrowheads
```
