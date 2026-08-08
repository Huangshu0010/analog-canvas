# Arrowhead Second-Pass Calibration Plan

## Goal

Apply the requested second-pass relative adjustments to the existing Razavi
arrowheads: MOS source-arrow width ×1.30 from its current ×1.20 setting
(overall ×1.56 from the Visio baseline), and independent-current-source head
length ×1.30 from its current ×1.30 setting (overall ×1.69); preserve the
current-source head width and shaft.

## Dirty-State Decision

The repository has unrelated untracked documents, netlist artifacts, plans,
and a probe script. The tracked symbol generators are clean and are the
explicit target of this requested visual calibration. This target owns only
the listed source generators, generator-owned output, its plan, and its log
entry.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- `scripts/generate-visio-core-analog-assets.mjs`
- generator-owned Razavi MOS/current-source assets, catalog, and fidelity board
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-08-arrowhead-second-pass/plan.md`
- `plan/log.md`

## Expected Work

1. Change only the second-pass MOS width and current-source head length
   factors.
2. Regenerate all generator-owned results and revise exact geometry tests.
3. Run focused symbol tests and generator validation.

## Validation

- [x] MOS/core-analog/Razavi generator checks.
- [x] Focused catalog and symbol tests (20 tests passed).
- [x] `git diff --check` and status audit.

## Outcome

- MOS head half-width is now 1.56× its Visio-derived baseline (the requested
  additional 30% from the preceding 1.20× setting).
- The independent-current-source head is now 1.69× its baseline length (the
  requested additional 30% from the preceding 1.30× setting). Its head width
  remains 1.15× baseline and its shaft endpoints are unchanged.

## Commit Intent

```text
style(razavi): apply second-pass arrowhead scaling
```
