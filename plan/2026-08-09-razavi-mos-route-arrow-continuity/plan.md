# Razavi MOS And Route-Arrow Continuity

## Goal

Use the existing raster-diff workflow to remove visible gaps between the
three-terminal NMOS/PMOS channel bars and their external leads, refine their
filled source arrows, and align the route-attached current-arrow token with
the sole Razavi reference.

## Dirty-State Decision

The worktree contains unrelated untracked RLC artifacts, other plans, and
`probe-conflicts.mjs`. The fidelity harness is committed on this branch and
is read-only for this target. None overlap the owned source geometry.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/generate-razavi-mos-assets.mjs`
- `scripts/generate-razavi-peripheral-assets.mjs` only if required for token
  generation
- generated MOS assets and catalog metadata
- `packages/derived/src/razavi-peripheral-geometry.generated.ts`
- focused MOS/catalog/style tests if their exact raster-derived expectations
  change
- this plan and `plan/log.md`

## Read-Only Dependencies

- `razavi-six-panel.png` remains the sole visual authority.
- The fidelity diff harness provides read-only scores and diagnostics.
- Electrical pin coordinates and three-/four-terminal semantics remain fixed.

## Expected Work

1. Capture NMOS/PMOS three-terminal baselines and use projection data to find
   gaps or registration differences.
2. Extend only visual primitives so channel-to-lead joins overlap cleanly.
3. Adjust source-arrow coordinates only when the projection supports it.
4. Confirm the route-current arrow dimensions from the reference pixel map and
   make one bounded token correction if needed.
5. Regenerate assets, rebuild affected packages, and compare once more.

## Validation

- focused fidelity diff for NMOS/PMOS
- source-asset and catalog generation checks
- focused Symbols tests and affected builds
- `git diff --check` and final status

## Commit Intent

`fix(razavi): close MOS joins and align route arrows`

## Result

Completed.

- Three-terminal NMOS/PMOS channel/support lines now overlap their external
  vertical leads by one measured pixel, eliminating butt-cap raster seams
  without moving any electrical pin anchor.
- Both source-arrow heads are two pixels wider; NMOS also gains a one-pixel
  forward tip/support extension to meet the source-side join.
- MOS viewBoxes now expand outward to integer scene bounds when a fractional
  pixel-mapped seam overlap reaches beyond the old edge; the generated assets
  remain valid without clipping their new visual primitive.
- NMOS binary/soft IoU improved from `0.7389`/`0.6246` to
  `0.7523`/`0.6406`. PMOS improved slightly from `0.6646`/`0.6279` to
  `0.6657`/`0.6304`; its remaining best translation is `(+1,+1)` pixels, so
  it is treated as registration/anti-alias error rather than an electrical
  geometry change.
- The route-current map already measures the reference as 80 px total, 26 px
  head length, and 15 px head width. No blind change was made to it.
