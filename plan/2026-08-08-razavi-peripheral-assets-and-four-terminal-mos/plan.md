# Razavi Peripheral Assets and Four-Terminal MOS

## Goal

Quickly extend the screenshot-authoritative Razavi geometry chain to voltage
sources, current sources, route-attached current arrows, and ground; repair the
four-terminal NMOS/PMOS bulk arrow and support line without changing the
accepted three-terminal variants.

## Dirty-State Note

The worktree contains unrelated untracked RLC outputs, older plans, and
`probe-conflicts.mjs`. They do not overlap this target and remain untouched.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/generate-razavi-peripheral-assets.mjs`
- `scripts/generate-razavi-mos-assets.mjs`
- `scripts/measure-razavi-reference.py`
- `scripts/generate-visio-core-analog-assets.mjs`
- `packages/symbols/assets/razavi-v1/{voltage-source,current-source,ground,nmos,pmos}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/derived/src/style-profile.ts`
- `packages/derived/src/razavi-peripheral-geometry.generated.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `package.json`
- this plan and `plan/log.md`

## Shared Dependencies

- Existing source and MOS electrical pin contracts remain unchanged.
- The accepted three-terminal MOS pixel geometry is read-only behavior.
- Razavi style profile remains the renderer contract for route markers.

## Expected Work

1. Record screenshot-pixel geometry for source bodies, source marks, ground,
   and the wire current arrow.
2. Generate the three peripheral symbol assets from that map and register
   raster provenance in the catalog.
3. Apply the measured route-arrow proportions to the Razavi style profile.
4. Replace the synthetic four-terminal MOS bulk arrows with compact
   screenshot-style arrows whose support lines meet their heads.

## Validation

User requested a fast iteration without visual validation. Run only asset
generation/catalog consistency needed to register outputs, plus mandatory
`git diff --check` and final status inspection.

## Result

Completed as a rapid asset iteration. Voltage source, current source, and
ground now come from a hash-bound peripheral pixel map tied to the sole Razavi
screenshot. Their catalog provenance points to the new raster generator, and
the legacy Visio batch generator explicitly skips these raster-owned symbols.
The route-attached current-arrow proportions are generated from the same map
and imported by the Razavi style profile.

Four-terminal NMOS and PMOS retain the accepted body geometry. Their bulk
support lines now stop at the arrow base instead of running beneath the filled
head: NMOS connects base-to-B and PMOS connects channel-to-base. Three-terminal
assets were not changed.

Per user direction, browser and visual regression validation were omitted.
Generation completed successfully; repository hygiene was checked with
`git diff --check` and final status inspection.

## Commit Intent

```text
fix(razavi): align peripheral assets and four-terminal MOS
```
