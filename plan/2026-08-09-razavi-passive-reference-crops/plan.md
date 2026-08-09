# Razavi Passive Reference Crops

## Goal

Record the resistor crop in the sole Razavi six-panel reference and compare
the rotated runtime resistor against it. Establish the capacitor's evidence
boundary: the sole reference contains no capacitor, so no substitute style
asset will be treated as visual authority.

## Dirty-State Decision

The worktree contains unrelated untracked RLC layout artifacts, older target
plans, and `probe-conflicts.mjs`. They do not overlap this target's reference
metadata, fidelity tooling, documentation, or plan paths.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/passive-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/razavi-fidelity-diff.mjs`
- `scripts/lib/razavi-fidelity.mjs`
- `scripts/lib/symbol-rasterize.mjs`
- `packages/symbols/assets/razavi-v1/resistor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Read-only Dependencies

- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`
  (sole visual authority)
- `packages/symbols/assets/razavi-v1/resistor.symbol.json`
- `packages/symbols/assets/razavi-v1/capacitor.symbol.json`

## Expected Work

1. Record a rotated resistor origin and crop window from panel (d).
2. Extend the fidelity rasterization path only as needed to render a symbol at
   the measured quarter-turn orientation, and report its baseline raster score.
3. Record in the style contract that capacitor calibration is blocked pending a
   capacitor-containing crop from the sole visual authority. Do not change the
   capacitor asset in this target.
4. If the recorded resistor baseline shows a clear body-geometry mismatch,
   update only its body path, lead joins, and style role, then regenerate the
   catalog and compare again.

## Validation

Build the symbols and direct dependencies required by the harness; run the
resistor target; confirm it rejects/omits an unrecorded capacitor target;
`git diff --check`; final status.

## Commit Intent

`fix(razavi): calibrate resistor to reference crop`

## Result

Recorded panel (d)'s R1 crop and added quarter-turn symbol rasterization for
fidelity targets. The first crop was tightened to exclude the two surrounding
Junctions and their routes. Its initial runtime resistor score was
`0.2360/0.1779` (binary/soft IoU), exposing the old broad round Visio zigzag.

Replaced only the resistor body and its joining lead endpoints with the eight
reference-measured sharp zigzag points and normal/butt/miter styling. The
second score rose to `0.6597/0.6068` with zero registration lift; remaining
differences are anti-aliased fine-line contour pixels.

The accepted raster has no capacitor. `capacitor` is intentionally rejected by
the fidelity CLI until an approved capacitor crop is recorded; the capacitor
runtime asset was not modified.

Validation: Symbols, Derived, and Render-SVG builds; catalog generator and
stale check; focused catalog/profile tests 17/17; resistor target; capacitor
rejection; `git diff --check`.
