# Razavi MOS Measured Arrow Finalization

## Goal

Apply the accepted 1204x794 Razavi raster measurements to the canonical
three-terminal MOS source arrow, replacing rounded intermediate values with
the measured final visible length and width.

## Dirty-State Note

Concurrent workers currently own dirty editor, drafting, render, API, and
`plan/log.md` paths. This target does not edit them. The MOS generator and
Razavi catalog test are clean. Because `plan/log.md` overlaps concurrent work,
this plan records its result locally and does not claim that shared log; its
commit contains only target-owned implementation and plan files.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- `packages/symbols/assets/razavi-v1/nmos.symbol.json` (generated only)
- `packages/symbols/assets/razavi-v1/pmos.symbol.json` (generated only)
- `packages/symbols/assets/razavi-v1/nmos3.symbol.json` (generated only)
- `packages/symbols/assets/razavi-v1/pmos3.symbol.json` (generated only)
- `packages/symbols/assets/razavi-v1/catalog.json` (generated only)
- `fixtures/visual-golden/visio-mos-fidelity.svg` (generated only)
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/src/razavi-catalog.generated.ts` (generated only)
- `plan/2026-08-08-razavi-mos-measured-arrow-finalization/plan.md`

## Read-Only Files

- `C:\Users\90590\AppData\Local\Temp\codex-clipboard-8388af7e-de56-4464-a5f4-9250dbbb031b.png`
- `scripts/measure-razavi-reference.py`
- `plan/log.md`
- `lib/circuit.vss`

## Shared Dependencies

- Source/drain and gate-axis calibration transforms in the MOS generator.
- Symbol DSL visual-only three-terminal variant contract.

## Expected Work

1. Convert the measured final values (8.1319 length, 7.551 total width) back
   through the existing 1.15 x-axis and 0.765 y-axis body calibration.
2. Regenerate the four MOS assets and prove both three-terminal variants use
   the resulting final dimensions.

## Validation

- `python scripts/measure-razavi-reference.py <accepted-reference>`
- `corepack pnpm symbols:visio-mos:check`
- focused Razavi catalog test
- `git diff --check`
- `git status --short --branch`

## Result

The accepted reference measures a 14-pixel arrow length and 13-pixel base at
1.7216 pixels per logical unit: 8.13189 final length and 7.551041 final width.
The generator now uses their inverse-calibrated local values 7.071209 and
4.935321, yielding that final geometry for both textbook MOS variants. The
support overlap remains 0.69 logical units, preserving the anti-alias seam
fix. Regenerated assets and catalog hashes passed their deterministic checks.

## Commit Intent

```text
fix(razavi): use measured MOS source-arrow dimensions
```
