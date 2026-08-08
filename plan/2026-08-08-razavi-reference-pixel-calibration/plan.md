# Razavi Reference Pixel Calibration Plan

## Goal

Use the supplied six-panel Razavi reference image as measurable evidence to
calibrate the runtime's symbol geometry, line weights, current markers, and
typography. Produce a repeatable measurement script and tune only parameters
that the image can actually establish.

## Dirty-State Decision

The worktree contains active drafting-contract work, an Agent parity test, and
unrelated netlist artifacts. They are read-only. The existing Razavi
generator-owned assets are currently dirty as part of their visual pipeline;
this target intentionally owns only their calibration parameters and generated
outputs after first recording the measurement basis. It will not modify
electrical topology or drafting contracts.

## Owned Files

- a new reference-measurement script under `scripts/`
- Razavi style profile/tokens, their focused tests, and route-marker visual
  golden if measurement supports a change
- Visio MOS/core-analog generators, catalog tests, and their generated
  assets/goldens if measurement supports a change
- `plan/2026-08-08-razavi-reference-pixel-calibration/plan.md`
- `plan/log.md`

## Read-Only Dependencies

- supplied clipboard reference image
- Symbol DSL schemas, electrical pins, routing, and all drafting-contract work
- existing visual-reference exports and formal render fixtures

## Expected Work

1. Measure reference image strokes, connected geometry, symbol proportions,
   arrow heads, and text bounding boxes in image pixels.
2. Normalize those observations to a common source/wire unit and compare them
   to the generated symbol/style parameters.
3. Add a deterministic calibration report/script, adjust only evidenced
   parameters, regenerate assets, and preserve exact tests/goldens.

## Validation

- [x] Measurement script produces a stable report from the supplied reference.
- [x] Relevant symbol/render tests and generator checks pass.
- [x] Regenerated and checked the MOS/core-analog fidelity boards plus Phase
  1/5 and route-marker visual goldens.
- [x] `git diff --check` and status audit.

## Outcome

- Added `scripts/measure-razavi-reference.py`, which fixes the supplied
  reference hash/size and reports reproducible pixel and normalized metrics.
- Reference measurements yield a 1.7216 px/logical MOS scale and calibrate the
  MOS source-arrow head to 8.13 by 7.55 logical units, the independent-current
  source head to approximately 10.37 by 10.37, and the route-marker head to
  approximately 13.36 by 8.71.
- Runtime values use the nearest stable geometry: MOS length/half-width scales
  0.80/1.65; independent current-source length/half-width 1.65/1.15; and
  route-marker head 14 by 9. Existing wire/gate, ground, port, and typography
  ratios matched the reference and remain unchanged.

## Commit Intent

```text
style(razavi): calibrate symbols and typography from reference pixels
```
