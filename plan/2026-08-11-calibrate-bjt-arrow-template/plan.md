---
status: completed
experience: none
---

# Calibrate the shared Razavi BJT arrow template

## Goal

Measure the direct-PDF NPN/PNP arrow footprints, make their GUI arrow template
identical up to the required orientation/placement, and correct its size and
support joins without changing BJT pins or body geometry.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the common BJT extraction geometry,
regenerated NPN/PNP evidence/assets/catalog output, their focused tests, and
the plan/log. The PDF and existing direct-crop witnesses are read-only input.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{npn,pnp}-*`
- `fixtures/visual-reference/razavi-reference-v1/{common-symbol-geometry.json,manifest.json}`
- `packages/symbols/{assets/razavi-v1/{npn,pnp}.symbol.json,src/razavi-catalog.generated.ts,src/razavi-catalog.test.ts}`
- `plan/2026-08-11-calibrate-bjt-arrow-template/plan.md`
- `plan/log.md`

Read-only: `docs/specs/razavi-visual-contract.md`, approved Razavi PDF, and
the read-only fidelity runner. `lib/circuit.vss` is out of scope.

## Work

1. Measure source and candidate arrow pixel footprints from the pinned direct-PDF crops.
2. Define one congruent triangle template and apply orientation/translation only for NPN and PNP.
3. Regenerate evidence/catalog artifacts and compare both targets.

## Validation

- Python extractor compilation
- common and full Razavi generator stale checks
- focused catalog tests and symbols build
- NPN/PNP fidelity reports and `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): unify Razavi BJT arrow geometry
```

## Outcome

Measured the shared arrow region against the direct-PDF witnesses: candidate
black ink was initially 25% below NPN and 33% below PNP. Both BJT symbols now
derive from one Figure 12.6 triangle template, magnified 1.18x; PNP is only a
horizontal mirror anchored at its base-bar tip. NPN source-region ink is now
within 5% of its witness and PNP within 16%; fidelity improved from
`0.6430` to `0.6436` (NPN) and `0.5284` to `0.5471` (PNP). Pins and body
geometry remain unchanged. Extractor compilation, stale checks, symbols build,
23 focused tests, both fidelity diffs, and `git diff --check` passed.
