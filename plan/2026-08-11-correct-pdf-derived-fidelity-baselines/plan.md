---
status: completed
experience: candidate
---

# Correct PDF-derived Razavi fidelity baselines

## Goal

Move `closed-switch` into the existing switch palette group and rebuild every recently added PDF-derived device comparison from an actual, hash-pinned source-PDF crop. Produce the reference/rendered/diff reports without treating candidate artwork as a reference.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns all PDF-derived evidence witnesses, their authority hashes and measurements, the generated common catalog entries, the editor grouping rule, focused assertions, and factual log.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `tools/pdf-vector-extract/{extract-razavi-inductor.py,extract-razavi-opamp.py}`
- `fixtures/visual-reference/razavi-reference-v1/{*-vector-source.json,*-reference.png,common-symbol-geometry.json,manifest.json,fidelity-targets.json}`
- `scripts/generate-razavi-common-assets.mjs`
- `packages/symbols/{assets/razavi-v1,src/razavi-catalog.generated.ts,src/razavi-catalog.test.ts}`
- `apps/editor/src/features/component-insert/{symbol-catalog.ts,symbol-catalog.test.ts}`
- `docs/specs/razavi-visual-contract.md`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- `plan/2026-08-11-correct-pdf-derived-fidelity-baselines/plan.md`
- `plan/log.md`

Read-only shared dependencies: `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`, `docs/specs/razavi-visual-contract.md`, external approved Razavi PDF, and the read-only fidelity renderer. `lib/circuit.vss` is out of scope.

## Work

1. Audit PDF-derived symbols and reject any witness whose source is candidate rendering rather than a direct approved-PDF crop.
2. Extend the source-crop witness protocol used by `closed-switch` to the PDF-derived common assets, inductor, and op-amp; retain their existing vector extraction and electrical pin semantics.
3. Regenerate pinned evidence, measurements, common catalog artifacts, and place `closed-switch` alongside `ideal-switch` in the switch category.
4. Run each PDF-derived target through the read-only fidelity runner and retain the report PNGs as derived output for review.
5. Make direct source-PDF crop witnesses mandatory in the visual contract and authority loader.

## Validation

- `pnpm symbols:razavi-common:check`
- `pnpm symbols:razavi:check`
- `pnpm --filter @icm/symbols build`
- focused catalog and authority tests
- `node scripts/razavi-fidelity-diff.mjs <each PDF-derived target>`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): use source PDF crops for common fidelity baselines
```

## Outcome

`closed-switch` is now classified under the editor's `Switches` group.
All eight PDF-derived targets now use a direct original-PDF crop witness with
the source page recorded; the authority loader rejects candidate/self-rendered
witnesses. The refreshed comparisons intentionally expose the prior false
baselines: inductor `0.7849`, op-amp `0.6769`, NPN `0.6430`, PNP `0.5284`,
diode `0.1514`, voltage amplifier `0.1957`, ideal switch `0.6342`, and closed
switch `0.9854` binary IoU. The diode and voltage-amplifier source selections
are now visibly poor matches and remain explicit calibration work rather than
being concealed by synthetic witnesses. Focused generator, authority, catalog,
editor grouping, build, and eight fidelity checks passed.
