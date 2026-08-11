---
status: completed
experience: none
---

# Calibrate Razavi diode orientation and voltage amplifier frame

## Goal

Compare the diode in the source PDF's vertical orientation without changing its
electrical pin contract, and calibrate the voltage-amplifier triangle frame
from the source PDF's native vector vertices while holding its leads and pins
fixed.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the common source-extraction geometry,
diode fidelity rotation/window, generated diode and voltage-amplifier assets,
authority hashes, focused tests, plan, and log.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{diode,voltage-amplifier}-*`
- `fixtures/visual-reference/razavi-reference-v1/{common-symbol-geometry.json,fidelity-targets.json,manifest.json}`
- `scripts/razavi-fidelity-diff.mjs`
- `packages/symbols/{assets/razavi-v1/{diode,voltage-amplifier}.symbol.json,src/razavi-catalog.generated.ts,src/razavi-catalog.test.ts}`
- `plan/2026-08-11-calibrate-diode-and-voltage-amplifier/plan.md`
- `plan/log.md`

Read-only: approved Razavi PDF, visual contract, and fidelity runner.
`lib/circuit.vss` is out of scope.

## Work

1. Register a source-owned vertical diode crop and select the orientation that matches the PDF figure.
2. Derive and apply the native voltage-amplifier triangle frame vertices while
   keeping its pins and exterior lead endpoints fixed.
3. Regenerate pinned evidence/assets and compare both target diffs.

## Validation

- Python extractor compilation
- common and full Razavi stale checks
- symbols build and focused catalog/authority tests
- diode and voltage-amplifier fidelity reports
- `git diff --check` and `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): calibrate diode and voltage amplifier geometry
```

## Outcome

- Registered the source-PDF diode witness in its true vertical orientation and
  added target-level `-90` degree rotation support to the fidelity runner.
  The aligned diode improved from the prior direct-crop baseline of 0.1514 to
  0.8800 IoU without registration translation; its `A`/`K` anchors remain
  `-20`/`20`.
- Replaced the voltage-amplifier's guessed uniform enlargement with Figure
  8.24 native-vector normalization: `x=±23.63`, `y=±28.62`, centreline
  `y=60.9472`. Its focused frame witness improved from 0.1957 to 0.7381 IoU;
  the remaining score is contour anti-aliasing (best shift `0,1`). Its `IN`/
  `OUT` anchors remain `-40`/`40`.
- Added stale-target rotation validation, displayed optimal registration shift
  in the fidelity summary, regenerated all pinned evidence/catalog artefacts,
  and updated focused geometry assertions.
