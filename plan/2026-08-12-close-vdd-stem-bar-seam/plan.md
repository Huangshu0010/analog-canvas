---
status: completed
experience: none
---

# Close VDD stem/bar seam

## Goal

Remove the visible gap between the VDD power-port stem and its horizontal bar
without changing its pin anchor, label rendering, or power-port semantics.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns the VDD asset, its generated catalog
output, one geometry regression, and plan/log entries.

- `packages/symbols/assets/razavi-v1/vdd.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-12-close-vdd-stem-bar-seam/plan.md`
- `plan/log.md`

Read-only: VDD reference raster/geometry, power-label text renderer, and pin
contract (`P` at `(0,20)`).

## Work

1. Extend the butt-capped VDD stem inside the filled bar by a controlled
   overlap, eliminating the current 0.14-unit separation.
2. Regenerate catalog hashes/output and assert the overlap relation.

## Validation

- symbols stale check/build and focused catalog test
- `git diff --check` and status check

## Commit Intent

```text
fix(symbols): close VDD stem and bar seam
```

## Outcome

- Traced the seam to the VDD stem ending at `y=2.5` while the filled bar ends
  at `y=2.36`: a 0.14-unit literal gap, introduced with the bar geometry on
  2026-08-09.
- Moved the stem endpoint to `y=1.5`, creating a 0.86-unit interior overlap
  with the bar. This preserves the `P` pin at `(0,20)` and ensures a
  continuous butt-capped T junction after anti-aliasing.
- Regenerated catalog hashes/output and added a regression that requires the
  stem to finish inside the filled bar.
- Symbols stale check/build, 20 focused catalog tests, and `git diff --check`
  pass. This is a branch-local commit; main delivery requires the CI gate.
