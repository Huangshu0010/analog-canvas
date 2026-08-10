---
status: completed
experience: none
---

# Add a Razavi PDF-derived op-amp

## Goal

Add only one reviewed Razavi op-amp symbol using the PDF-vector evidence
pipeline established for the inductor. Keep PDF extraction, Symbol generation,
and raster comparison separate, and reuse the compatible manifest protocol.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? plan/2026-08-11-fixed-insert-dialog-layout/
```

The untracked `plan/2026-08-11-fixed-insert-dialog-layout/` belongs to another
target and is left untouched. It does not overlap this target's asset, evidence,
catalog, or validation paths. This target owns:

- `tools/pdf-vector-extract/extract-razavi-opamp.py`
- `tools/pdf-vector-extract/README.md`
- `scripts/generate-razavi-opamp-asset.mjs`
- `packages/symbols/assets/razavi-v1/opamp.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/src/builtins.test.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.test.ts`
- `fixtures/visual-reference/razavi-reference-v1/opamp-*`
- `fixtures/visual-reference/razavi-reference-v1/fidelity-targets.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `docs/specs/razavi-visual-contract.md`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- `package.json`
- `plan/2026-08-11-razavi-pdf-opamp/plan.md`
- `plan/log.md`

Read-only inputs and shared dependencies:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`
- Existing Razavi evidence and all non-op-amp symbols remain unchanged.
- `plan/2026-08-11-fixed-insert-dialog-layout/` is unrelated user/worker state.
- The Symbol DSL and catalog are shared contracts; this target adds one symbol
  without changing their schemas.

## Work

1. Locate a clean native-vector op-amp in the pinned textbook and record a
   deterministic path/object fingerprint and raster witness.
2. Add the op-amp as a new `pdf-vector-extract` manifest entry using the
   existing compatible authority loader.
3. Generate one Symbol DSL asset with explicit on-grid electrical pins,
   register it in the reviewed catalog and GUI palette, and do not invent an
   automatic SPICE mapping.
4. Add focused provenance, geometry, palette, and pixel-fidelity checks.

## Validation

- Verify source PDF hash and selected object fingerprint.
- Run op-amp generator write and stale-check modes.
- Run focused authority, Symbol catalog, built-in library, and editor catalog
  tests.
- Build affected packages and run `node scripts/razavi-fidelity-diff.mjs opamp`.
- Run repository typecheck and changed-file formatting.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(symbols): add PDF-derived Razavi op-amp
```

## Outcome

Added one reviewed three-terminal Razavi op-amp from the native PDF objects in
textbook Figure 8.26. The extractor fingerprints the duplicated triangle path,
three terminal leads, and vector polarity marks, then creates an isolated
selection-only witness so surrounding feedback wires and junction dots cannot
enter the baseline. The manifest pins the extract, witness, and measurement;
the generator creates `IN+`, `IN-`, and `OUT` grid pins and semantic
`normal`/`emphasis` strokes. The symbol is exposed in a new `Analog Blocks`
palette group with no inferred SPICE mapping or hidden supply pins.

Validation passed for exact extractor reproduction, source/path fingerprint,
authority and generator stale checks, symbols/editor production builds,
repository typecheck, 31 focused tests, changed-file formatting, and
`git diff --check`. The fidelity run reported binary IoU `0.7330`, soft IoU
`0.8037`, zero registration lift, and 100% edge-shell disagreement
(`anti-alias` verdict); the spatial diff showed aligned geometry with only
stroke-contour differences.
