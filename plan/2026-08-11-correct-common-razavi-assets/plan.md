---
status: completed
experience: candidate
---

# Correct overclaimed common Razavi assets

## Goal

Remove the unsupported transformer, rebuild NPN/PNP arrows from separate direct
textbook figures, verify and faithfully represent the diode and dependent
current-source evidence, and restore the source-observed op-amp body/lead stroke
hierarchy in the GUI.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This correction owns:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `scripts/generate-razavi-common-assets.mjs`
- affected common/op-amp Symbol assets and generated Razavi catalog
- the shared Razavi emphasis-stroke profile, its focused renderer tests, and
  the visual-contract value that governs reviewed heavy geometry
- common PDF evidence, witnesses, fidelity registry, and authority manifest
- GUI catalog and SPICE/catalog tests required by removals or corrected IDs
- Razavi visual contract and PDF-evidence ADR corrections
- `plan/2026-08-11-correct-common-razavi-assets/plan.md`
- `plan/log.md`

Read-only inputs are the approved Razavi textbook PDF and all unrelated
reviewed symbols. `lib/circuit.vss` remains untouched.

## Work

1. Render and inspect the exact NPN, PNP, diode, VCCS, and op-amp source
   regions; record which geometry is direct, derived, or unsupported.
2. Remove transformer catalog/evidence/GUI exposure and update the common
   extractor/generator contract.
3. Rebuild NPN and PNP arrow/body geometry from their own source figures and
   correct the dependent-source/diode witnesses without inventing geometry.
4. Ensure the op-amp triangle uses the source-observed heavier stroke role and
   that GUI rendering preserves the visible hierarchy.
5. Regenerate, run focused tests/builds/fidelity comparisons, inspect the GUI,
   and commit the correction.

## Validation

- Source PDF hash, page/figure/object fingerprints, and regenerated witnesses
- common/op-amp generator stale checks and authority integrity tests
- focused Symbol, GUI catalog, renderer, and SPICE tests
- registered fidelity comparisons and in-app GUI inspection
- repository typecheck and affected builds
- targeted formatting, `git diff --check`, and final status

## Commit Intent

Commit as:

```text
fix(symbols): correct common Razavi source fidelity
```

## Outcome

Removed the unsupported transformer from evidence, product catalog, GUI, and
fidelity targets. NPN Figure 12.6 and PNP Figure 12.11 now use separately
normalized native-vector bodies and emitter arrows; the diode uses the outline
triangle and double-width cathode bar from Figure 15.54; and VCCS provenance
now distinguishes Figure 2.37 artwork from the SPICE-required grid terminal
extensions. Razavi emphasis strokes are 1.5 times normal, which restores the
visible op-amp frame/lead hierarchy.

Validation passed: source hash and authority integrity; common, op-amp, and
catalog stale checks; 35 focused tests; Symbols/Derived/Render builds;
repository typecheck; editor production build; registered NPN/PNP/diode/VCCS/
op-amp fidelity comparisons; in-app GUI inspection; formatting; and
`git diff --check`. The editor build retains its existing large-chunk warning.
