# Four-Terminal MOS Bulk Continuity

## Goal

Make the four-terminal NMOS bulk arrow touch the gate-side horizontal bar and
make the PMOS bulk-arrow extension line continuous from the same bar, without
changing three-terminal MOS presentation.

## Dirty-State Note

Only unrelated untracked RLC outputs, older plans, and `probe-conflicts.mjs`
are present. They do not overlap this target and remain untouched.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/measure-razavi-reference.py`
- `scripts/generate-razavi-mos-assets.mjs`
- `packages/symbols/assets/razavi-v1/{nmos,pmos}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- this plan and `plan/log.md`

## Shared Dependencies

- D/G/S/B electrical pins stay unchanged.
- `sourceArrowPx` and both three-terminal assets are read-only behavior.

## Expected Work

Represent four-terminal bulk support as multiple visible segments where
needed, regenerate only canonical NMOS/PMOS and the catalog, and preserve the
accepted three-terminal hashes.

## Validation

Fast generator/catalog registration plus mandatory `git diff --check` and
status inspection; no browser review unless requested.

## Result

Completed. Four-terminal NMOS now has one bulk segment from the inner gate bar
to the arrow tip and a second from the arrow base to B. Four-terminal PMOS has
one continuous segment from the inner gate bar to the arrow base, followed by
the outward arrow to B. The accepted three-terminal assets retained byte-for-
byte identical SHA-256 hashes.

MOS assets and the catalog were regenerated. No browser review was requested;
close-out used `git diff --check` and final status inspection.

## Commit Intent

```text
fix(razavi): connect four-terminal bulk arrows to gate bars
```
