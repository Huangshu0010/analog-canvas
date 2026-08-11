---
status: completed
experience: none
---

# Calibrate Razavi Ideal Switch

## Goal

Rebuild the two-terminal ideal-switch geometry and stroke mapping from the
native vector objects in Razavi Figure 13.4, replacing the current
self-referential hand-normalized witness so the GUI asset matches the source
proportions and line weight.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns only the ideal-switch extraction,
evidence, generated symbol/catalog outputs, authority hashes, focused tests,
and this target's plan/log records:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/ideal-switch-*`
- `fixtures/visual-reference/razavi-reference-v1/common-symbol-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/ideal-switch.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- focused symbol/extraction tests if required
- `plan/2026-08-11-calibrate-ideal-switch/plan.md`
- `plan/log.md`

Read-only source and shared contracts:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- `docs/specs/razavi-visual-contract.md`

## Work

1. Inspect Figure 13.4 visually and identify the exact native switch objects,
   line width, terminal spacing, and open-blade geometry.
2. Make the common-asset extractor derive the switch definition and PDF
   witness from those objects instead of rendering a hand-authored proxy.
3. Regenerate evidence, authority hashes, Symbol DSL, catalog outputs, and the
   runtime catalog.
4. Run focused fidelity and symbol-contract checks.

## Validation

- ideal-switch PDF object fingerprint/geometry checks
- `node scripts/razavi-fidelity-diff.mjs ideal-switch`
- `corepack pnpm symbols:razavi-common:check`
- `corepack pnpm symbols:razavi:check`
- focused `@icm/symbols` tests
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): calibrate Razavi ideal switch
```

## Outcome

Figure 13.4 is now sampled from the exact five native switch objects rather
than the former broad region that also captured the S2 label and feedback
wiring. The PDF's 0.717 pt stroke is uniformly normalized to the Razavi 1.6
normal role; the source proportions yield 60-unit on-grid pin spacing,
approximately 3.20-unit contact radii, and a normal-weight open blade. The
generated evidence, witness, Symbol DSL, catalog, and runtime catalog were
updated. Focused generator checks and 23 tests passed; the registered fidelity
comparison reached IoU 0.9814 with all residual error classified as
anti-aliasing.
