# Razavi capacitor proportion refinement

## Goal

Reduce the Razavi capacitor plate span and plate-center separation by an
evidence-guided approximately 10%, while retaining continuous leads and a
single asset that is correct in both vertical and horizontal presentation.

## Dirty-State Decision

The working tree contains concurrent editor drafting, rich-text, drag,
selection, model, and renderer changes. They do not overlap the capacitor
asset/catalog or fidelity fixtures owned here. `plan/log.md` is shared and
already modified by concurrent work; its entry will be staged as an isolated
hunk only.

## Owned Files

- `packages/symbols/assets/razavi-v1/capacitor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts` only if an asset assertion
  needs updating
- this plan and the isolated `plan/log.md` hunk

## Read-Only Dependencies

- `fixtures/visual-reference/razavi-reference-v1/capacitor-reference.png`
- `fixtures/visual-reference/razavi-reference-v1/capacitor-geometry.json`
- `scripts/razavi-fidelity-diff.mjs`
- concurrent editor/drafting work and `lib/circuit.vss`

## Method

1. Treat the present capacitor as the baseline in both C1 vertical and C2
   horizontal raster windows.
2. Scale plate half-span `7.086614` and plate half-separation `3.11811` by
   0.90; adjust lead start coordinates to preserve plate-to-lead continuity.
3. Regenerate the catalog, run both fidelity targets, and retain the candidate
   only if the two-orientation result is not contradicted by the measurements.

## Validation

- both capacitor fidelity targets
- `corepack pnpm symbols:razavi:check`
- focused Symbols catalog test and Symbols build
- `git diff --check` and review of staged paths

## Commit Intent

`fix(symbols): refine Razavi capacitor proportions`

## Result

The accepted candidate applies a 0.90 scale to the plate half-span
(`7.086614 → 6.377953`) and center half-separation
(`3.118110 → 2.806299`). The lower lead start retains its existing relative
continuity allowance (`3.401575 → 3.089764`).

After catalog generation, the initial fidelity command still read the previous
compiled Symbols output. Rebuilding `@icm/symbols` corrected that stale-artifact
boundary. The actual candidate improved both independent targets: C1 vertical
binary/soft IoU `0.5860/0.5120 → 0.6174/0.5595`; C2 horizontal
`0.6982/0.5046 → 0.7019/0.5508`. The catalog asset hash and generated runtime
definition were regenerated together.
