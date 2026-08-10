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
2. Use the initial 0.90 candidate only to establish the direction, then scan
   plate half-span and plate half-separation independently against both crops;
   adjust lead start coordinates to preserve plate-to-lead continuity.
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

The accepted candidate is based on a two-dimensional, two-orientation scan:
plate half-span uses 0.91 scale (`7.086614 → 6.448819`) and center
half-separation uses 0.745 scale (`3.118110 → 2.322992`). The lower lead start
retains its existing relative continuity allowance (`3.401575 → 2.606457`).

After catalog generation, the initial fidelity command still read the previous
compiled Symbols output. Rebuilding `@icm/symbols` corrected that stale-artifact
boundary. The initial 0.90/0.90 candidate improved C1 to `0.6174/0.5595` and
C2 to `0.7019/0.5508`, but it was only a heuristic. The measured joint optimum
improves the independent targets further to C1 `0.6225/0.5619` and C2
`0.7063/0.5508` (binary/soft IoU). The catalog asset hash and generated runtime
definition were regenerated together.
