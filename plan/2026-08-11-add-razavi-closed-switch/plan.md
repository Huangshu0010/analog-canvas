---
status: completed
experience: none
---

# Add Razavi Closed Switch

## Goal

Add one reviewed, manual-only two-terminal closed-switch symbol from the
approved Razavi textbook's printed page 542, using the existing PDF-vector
evidence protocol and raster fidelity regression workflow.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the closed-switch extraction, its
pinned evidence and witness, generated Symbol/catalog/runtime output, focused
registration tests, and target plan/log records:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/closed-switch-*`
- `fixtures/visual-reference/razavi-reference-v1/{common-symbol-geometry.json,fidelity-targets.json,manifest.json}`
- `packages/symbols/assets/razavi-v1/{closed-switch.symbol.json,catalog.json}`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-11-add-razavi-closed-switch/plan.md`
- `plan/log.md`

Read-only: the approved Razavi textbook PDF, the existing `ideal-switch`
evidence, and the PDF-vector/Razavi visual-contract specifications. The
existing open switch remains unchanged.

## Work

1. Render and inspect the printed-page-542 source region, then identify the
   exact native closed-switch objects and stroke widths.
2. Extend the isolated common PDF extractor with a closed-switch asset and
   explicit on-grid two-terminal semantics.
3. Generate pinned vector evidence, raster witness, Symbol DSL, catalog/runtime
   registration, measurement, and fidelity target.
4. Validate source extraction, authority hashes, geometry, catalog exposure,
   and pixel comparison.

## Validation

- PDF source hash and closed-switch native-object topology checks
- `node scripts/razavi-fidelity-diff.mjs closed-switch`
- common/catalog generator stale checks and symbols build
- focused symbol catalog and authority tests
- enlarged raster inspection
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(symbols): add Razavi closed switch
```

## Outcome

Added the reviewed `closed-switch` palette symbol from Figure 13.5 S2 on
printed page 542. Its two native hollow contact outlines and native horizontal
closure line retain the source stroke mapping; the closure is clipped to the
contact boundaries so the source's white hollow interiors remain clean in the
Symbol DSL. The two external leads are explicit semantic extensions to on-grid
pins at `(-30, 0)` and `(30, 0)`. It is manual-only and has no SPICE `S`
mapping. Evidence, witness, authority hashes, fidelity target, catalog, and
runtime registration were generated. Focused checks passed and the registered
fidelity result is IoU 0.9866 with anti-alias-only residuals.
