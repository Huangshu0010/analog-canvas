# Razavi Peripheral Fidelity

## Goal

Make Razavi ground bars and independent current-source outline match the sole
reference more closely. Confirm that Port origins retain the reference's same
6.5 px radius as Junctions, and distinguish the formal renderer from the
editor's interactive endpoint overlay.

## Dirty-State Decision

The worktree contains unrelated untracked RLC layout artifacts, older target
plans, and `probe-conflicts.mjs`. They do not overlap the peripheral source,
style-profile, symbol schema, fidelity-tool, documentation, or plan paths
owned by this target, so work proceeds without modifying them.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/generate-razavi-peripheral-assets.mjs`
- `packages/symbols/src/schema.ts`
- `packages/derived/src/style-profile.ts`
- `packages/derived/src/razavi-peripheral-geometry.generated.ts`
- `packages/render-svg/src/style-profile.test.ts`
- generated Razavi source/asset catalog outputs required by the generator
- `docs/specs/visual-language.md`, `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Read-only Dependencies

- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`
  (sole visual authority)
- `packages/render-svg/src/render.ts`
- `apps/editor/src/App.tsx` and `apps/editor/src/styles.css`
- `packages/symbols/src/razavi-catalog.generated.ts` except if the catalog
  generator determines regeneration is required

## Expected Work

1. Retain the common measured 6.5 px Port-origin and Junction radius. Preserve
   the existing profile regression that proves they use the same geometry; do
   not mistake the editor's `.endpoint-hit.active` overlay for a Port asset.
2. Add an independently named, profile-owned GND-bar stroke role so its
   increase does not alter MOS, resistor, or capacitor emphasis strokes.
3. Change the current-source circle to the reference's normal stroke role.
4. Use existing source/ground raster targets for bounded before/after
   evidence. Do not tune capacitor or resistor until their own reference crops
   are recorded.

## Validation

Run the peripheral generator and stale-output check, focused style and symbol
schema tests, affected package builds, targeted raster reports, `git diff
--check`, and final status. Treat absolute IoU as a relative signal only for
anti-aliased small circles and lines.

## Commit Intent

`fix(razavi): refine peripheral reference fidelity`

## Result

Implemented a screenshot-mapped 5 px GND-bar stroke as its own `ground`
symbol role (2.906977 scene units), so MOS/resistor/capacitor emphasis geometry
is unchanged. The independent current-source circle now uses the normal role.
The profile retains the shared 6.5 px Port-origin and Junction radius.

The Port discrepancy was traced to the editor's `.endpoint-hit.active` overlay
(`r=8`, white fill and blue stroke), which overlays the formal Port circle in
wire mode. The formal renderer emits identical filled-circle geometry for Port
and Junction; this target deliberately does not change interaction affordances.

Validation: peripheral and catalog generation plus stale-output checks passed;
Symbols, Derived, and Render-SVG builds passed; focused catalog/profile tests
passed (16 tests). Source/GND fidelity: current-source binary/soft IoU changed
0.6496/0.6630 to 0.6413/0.6200 after the user-required normal outline; ground
improved from 0.7698/0.6337 to 0.7810/0.6940. A broader `render.test.ts` run
has three known stale SVG-golden failures caused by already-committed MOS
geometry changes, so those unrelated golden assets were not edited.
