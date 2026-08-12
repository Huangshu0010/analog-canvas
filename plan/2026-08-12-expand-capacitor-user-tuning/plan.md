---
status: completed
experience: none
---

# Expand Capacitor Geometry by User Tuning

## Goal

Apply the requested visual refinement to the currently integrated Razavi
capacitor: increase plate length by 10% and plate center separation by 20%.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/vdd-drawn-rail...origin/codex/vdd-drawn-rail
```

The worktree is clean. This target owns:

- `packages/symbols/assets/razavi-v1/capacitor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `plan/2026-08-12-expand-capacitor-user-tuning/plan.md`
- `plan/log.md`

Read-only: capacitor pin positions, registered reference raster, and the
Symbol DSL contract. Pins remain unchanged; only visual primitives move.

## Work

1. Multiply plate half-length by `1.10` and plate-center distance by `1.20`.
2. Move the lead endpoints onto their corresponding expanded plate centers.
3. Regenerate the catalog and rebuild symbols for the running renderer.

## Validation

- Razavi symbol generation/catalog check and Symbols build
- `git diff --check` and `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): expand capacitor plates and spacing
```

## Outcome

Applied the requested current-baseline refinement: plate half-length changed
from `6.255354` to `6.880889` (110%), and centers from `±2.694671` to
`±3.233605` (120%). Leads now terminate exactly at the new plate centers;
pins remain at `y=±20`. Razavi catalog generation/check, Symbols build, and
`git diff --check` passed. Ready to commit and push on
`codex/vdd-drawn-rail`.
