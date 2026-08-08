# Razavi Complete MOS Pixel Map

## Goal

Replace the legacy-coordinate skeleton still present in the raster MOS
generator with a complete, checked-in pixel measurement map derived from the
sole Razavi reference; generate and register all MOS visual primitives only
from that map.

## Dirty-State Note

The worktree contains unrelated untracked RLC outputs, older target plans, and
`probe-conflicts.mjs`. All MOS measurement, generator, catalog, asset, test,
and log paths are clean at target start. Those unrelated paths remain
untouched.

## Owned Files

- `scripts/measure-razavi-reference.py`
- `scripts/generate-razavi-mos-assets.mjs`
- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/{catalog,nmos,nmos3,pmos,pmos3}.symbol.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-08-razavi-complete-mos-pixel-map/plan.md`
- `plan/log.md`

## Read-Only Files

- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`
- `lib/circuit.vss`
- all Visio extractors and visual references

## Shared Dependencies

- Existing D/G/S/B pin order and grid anchors remain the electrical contract.
- Symbol DSL primitive and three-terminal presentation variant schemas.
- Editor consumes the generated catalog through `@icm/symbols`.

## Expected Work

1. Expand raster measurement to a full pixel map: reference origin/scale,
   gate rectangles, upper/lower channel segments, D/G/S leads, NMOS/PMOS
   arrow support/head, and explicit bulk presentation.
2. Check in that map with the sole-reference hash and make the generator reject
   missing fields or mismatched authority.
3. Remove all geometry literals from the generator except electrical grid pins;
   convert pixels to final Symbol DSL coordinates in one place.
4. Regenerate/catalog/test, then force-refresh the running editor and assert
   its actual SVG equals the pixel-map-derived coordinates.

## Validation

- reference measurement regeneration/check
- `corepack pnpm symbols:razavi-mos:check`
- `corepack pnpm symbols:razavi:check`
- focused Razavi catalog tests
- symbols/editor builds
- running-editor DOM registration inspection
- `git diff --check`
- `git status --short --branch`

## Result

Completed. The sole screenshot now produces a checked-in, hash-bound pixel
map for both NMOS and PMOS. The MOS generator contains only the electrical
D/G/S/B pin contract; gate rectangles, channels, leads, and visible arrows
are converted from that pixel map. Catalog tests independently perform the
same pixel-to-logical conversion, so legacy visual coordinates can no longer
satisfy the regression tests.

The running editor was force-refreshed and inspected through its actual SVG.
NMOS rendered the mapped `-3.662791` channel start and screenshot-derived
arrow polygon; PMOS rendered its independently measured arrow beginning at
`-2.790698,-7.122093`. The former `-6.716614` legacy channel coordinate was
absent. Temporary verification instances were undone and the document was
returned to zero instances.

## Commit Intent

```text
fix(razavi): generate MOS geometry solely from pixel map
```
