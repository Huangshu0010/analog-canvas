---
status: completed
experience: none
---

# Calibrate Razavi Capacitor Plates

## Goal

Correct the Razavi capacitor's plate length and plate separation against the
registered capacitor raster without changing its pin contract or wiring
anchors.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean before this target. This target owns:

- `packages/symbols/assets/razavi-v1/capacitor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `plan/2026-08-12-calibrate-capacitor-plates/plan.md`
- `plan/log.md`

Read-only evidence and shared contracts:

- `fixtures/visual-reference/razavi-reference-v1/capacitor-reference.png`
- `fixtures/visual-reference/razavi-reference-v1/capacitor-geometry.json`
- Symbol pin positions and the Symbol DSL schema.

## Work

1. Extend the two plate bodies and their center separation by the reported
   visual correction while retaining the existing pins at `y=-20` and `y=20`.
2. Regenerate catalog data and rebuild the package consumed by the fidelity
   comparator.
3. Compare both registered capacitor orientations and retain the updated
   geometry only when the deterministic metrics improve or remain stable.

## Validation

- `pnpm symbols:razavi` and `pnpm symbols:razavi:check`
- `pnpm --filter @icm/symbols build`
- `node scripts/razavi-fidelity-diff.mjs capacitor-vertical capacitor-horizontal`
- focused `@icm/symbols` catalog tests
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): calibrate Razavi capacitor plate geometry
```

## Outcome

Adjusted the plate half-length to `6.255354` logical units (97% of the prior
value) and each plate center to `±2.694671` (116% of the prior separation),
with both leads ending exactly on their plate centerlines. A two-variable
pixel scan against the registered raster selected this value over the requested
rough 30% estimate: vertical IoU improved from `0.6225` to `0.6438` and
horizontal IoU from `0.7063` to `0.7247`; both have zero registration lift.
Symbol generation/check, catalog tests, package build, fidelity comparison,
and `git diff --check` passed. Ready to commit on
`codex/capacitor-plate-calibration`.
