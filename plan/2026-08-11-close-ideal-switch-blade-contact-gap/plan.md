---
status: completed
experience: none
---

# Close the ideal-switch blade/contact gap

## Goal

Use the closed-switch contact overlap as the calibration for the ideal-switch
blade, so the blade joins the hollow pivot ring continuously without entering
its inner void.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns the switch generator, regenerated
ideal-switch evidence/assets/catalog, its focused assertion, and plan/log.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{ideal-switch-vector-source.json,manifest.json}`
- `packages/symbols/assets/razavi-v1/{catalog.json,ideal-switch.symbol.json}`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-11-close-ideal-switch-blade-contact-gap/plan.md`
- `plan/log.md`

Read-only: the source PDF, closed-switch asset, and all pin contracts.

## Work

1. Measure the closed-switch blade's centreline clearance beyond its pivot
   circle and apply that contact-ring overlap to the ideal-switch blade.
2. Regenerate source-pinned artefacts and update the exact clearance test.

## Validation

- Python compile, common/catalog stale checks, symbols build, focused tests
- ideal-switch fidelity report, `git diff --check`, and status check

## Commit Intent

```text
fix(symbols): close ideal switch blade contact gap
```

## Outcome

- Recalibrated the ideal-switch blade start to `radius + 0.312427`, the
  centreline clearance measured from the closed-switch blade and pivot ring.
  This overlaps the contact-ring ink continuously while remaining outside its
  hollow interior.
- Regenerated the source evidence, manifest hashes, asset, and runtime
  catalog. The focused assertion now pins the exact contact clearance rather
  than the unsuitable outer-ink-edge clearance.
- Python compile, stale checks, symbols build, 23 focused tests, direct-PDF
  fidelity report, and `git diff --check` pass.
