---
status: completed
experience: none
---

# Expand Capacitor Plate Length

## Goal

Increase the current Razavi capacitor plate length by the requested 30%, with
plate spacing and electrical pins unchanged.

## State and Ownership

Worktree was clean on `codex/vdd-drawn-rail`. This target owns the capacitor
asset, regenerated catalog, target record, and factual log.

## Work

1. Change plate half-length from `6.880889` to `8.945156`.
2. Regenerate catalog artifacts and build Symbols.

## Validation

- Razavi catalog generation/check and Symbols build
- `git diff --check`

## Commit Intent

`fix(symbols): extend capacitor plates`

## Outcome

Changed plate half-length from `6.880889` to `8.945156` (+30%), preserving
the current `±3.233605` plate centers and `y=±20` pins. Razavi catalog
generation/check, Symbols build, and `git diff --check` passed.
