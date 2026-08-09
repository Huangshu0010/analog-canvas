# Voltage-Source Raster Alignment

## Goal

Use the new read-only Razavi fidelity harness to determine whether the
voltage-source mismatch is caused by geometry or rasterization, then make the
smallest source-geometry correction that materially improves the comparison.

## Dirty-State Decision

`package.json`, `pnpm-lock.yaml`, the fidelity harness, generated diff PNGs,
and several RLC artifacts and plans are uncommitted work owned by another
worker. They are read-only dependencies for this target and will not be
modified. This target owns only the voltage-source source geometry and its
required generated/profile metadata.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/generate-razavi-peripheral-assets.mjs`
- `packages/symbols/assets/razavi-v1/voltage-source.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json` if its asset hash changes
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- this plan and `plan/log.md`

## Read-Only Dependencies

- `razavi-six-panel.png` is the sole visual authority.
- Fidelity scripts and their output directory are owned by the preceding
  harness target.
- The current and source geometry pipeline remains unchanged except for the
  measured voltage-source values.

## Expected Work

1. Run the diff once on the current built catalog.
2. Use numerical projections and at most one visual diff inspection to
   distinguish a coordinate error from anti-aliasing noise.
3. Adjust only the voltage-source pixel geometry when evidence supports it.
4. Correct the voltage-source stroke role when the raster evidence identifies
   a role mismatch, then regenerate the peripheral assets and catalog, rebuild the Symbols package,
   and compare the resulting built catalog once.

## Validation

- `node scripts/razavi-fidelity-diff.mjs voltage-source`
- peripheral and catalog generation checks
- Symbols build
- `git diff --check` and final status

## Commit Intent

`fix(razavi): align voltage source to raster reference`

## Result

Completed.

- The fidelity harness was suitable for locating the mismatch, but its binary
  IoU is treated as a regression signal rather than a pixel-perfect gate for
  circles and text-like polarity marks.
- One visual diff inspection plus component projections showed an overly heavy
  circle outline and a one-pixel registration offset, rather than a missing
  source feature.
- The voltage-source circle now uses the normal stroke role. Its screenshot
  origin moved one pixel right/down and its polarity axis one pixel right.
- After regeneration and Symbols rebuild, binary IoU improved from `0.5621` to
  `0.6565`; soft IoU improved from `0.4419` to `0.5595`.
