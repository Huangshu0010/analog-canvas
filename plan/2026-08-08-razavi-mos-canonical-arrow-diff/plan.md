---
status: completed
experience: candidate
---

# Razavi MOS Canonical Arrow Diff

## Goal

Make the Razavi three-terminal MOS arrow a single canonical geometric
construction, with PMOS derived by mirror rather than a separately calibrated
VSS marker; add deterministic geometry checks that guard the visible arrow
dimensions and the support-line overlap against regressions.

## Dirty-State Note

Start state contains unrelated concurrent edits in `apps/editor/`, model,
derived, render, API fixtures, and RLC fixture outputs. This target owns none
of those paths. `scripts/generate-visio-mos-assets.mjs`,
`packages/symbols/assets/razavi-v1/{nmos,pmos,nmos3,pmos3}.symbol.json`, and
`packages/symbols/src/razavi-catalog.test.ts` are clean at target start and
are safe to change. `lib/circuit.vss` remains binary and read-only.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- `packages/symbols/assets/razavi-v1/nmos.symbol.json`
- `packages/symbols/assets/razavi-v1/pmos.symbol.json`
- `packages/symbols/assets/razavi-v1/nmos3.symbol.json`
- `packages/symbols/assets/razavi-v1/pmos3.symbol.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `fixtures/visual-golden/visio-mos-fidelity.svg`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/log.md`

## Read-Only Files

- `fixtures/visual-reference/visio-mos/`
- `fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json`
- `scripts/measure-razavi-reference.py`
- `lib/circuit.vss`

## Shared Dependencies

- Symbol DSL primitive and variant schema.
- Existing VSS-derived source anchors and electrical pin locations.
- The Razavi style profile resolves semantic stroke roles at render time.

## Expected Work

1. Derive source-arrow coordinates from an explicit canonical metric record,
   retaining VSS only for the electrical source direction and anchor.
2. Generate the textbook PMOS arrow from the same visible dimensions as NMOS,
   only mirrored in direction; retain four-terminal geometry and the
   visual-only 3-terminal variant contract.
3. Add deterministic regression assertions for congruent arrow triangles and
   support-line overlap, then regenerate checked-in symbol assets.

## Validation

- `corepack pnpm symbols:visio-mos:check`
- `corepack pnpm vitest run packages/symbols/src/razavi-catalog.test.ts`
- `git diff --check`
- `git status --short --branch`

The generator check proves generated artifacts match source. The focused test
proves the canonical-arrow invariant and visible variant contract; no editor
or electrical behavior changes are made.

## Experience Signal (for human review)

The supplied raster image can calibrate dimensions, but exact raster matching
also requires a fixed browser/font/DPR screenshot harness. This target locks
geometry first; visual screenshot capture remains a separate runtime concern.

## Commit Intent

Commit as:

```text
fix(razavi): derive MOS arrows from canonical geometry
```
