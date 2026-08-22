---
status: completed
experience: none
---

# Razavi Logic-Gate Continuity and Scale

## Goal

Remove visible gaps in the inverter and NAND leads/bubble junctions, and verify
the logic-gate family scale against native textbook geometry plus an established
Razavi passive reference before adjusting proportions.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/razavi-logic-gate-alignment...origin/codex/razavi-logic-gate-alignment
```

The dedicated worktree is clean. This target continues the reviewed logic-gate
family without touching the user's main worktree.

Owned paths:

- `tools/pdf-vector-extract/extract-razavi-logic-gates.py`
- logic-gate evidence, geometry registry, and authority manifest under
  `fixtures/visual-reference/razavi-reference-v1/`
- `scripts/generate-razavi-logic-gate-assets.mjs`
- the seven logic-gate assets and catalog/generated catalog artifacts
- focused symbol/fidelity tests, this plan, and `plan/log.md`

Read-only scale references:

- the pinned Razavi textbook PDF
- existing reviewed resistor/capacitor/MOS geometry and assets

Shared dependencies: PDF evidence hashes, 10-unit electrical pin grid, common
Razavi stroke tokens, symbol catalog generation, GUI runtime registration.

## Work

1. Measure the source-body endpoints and generate overlap-safe leads and
   inversion-bubble joins from actual geometry, not crop bounds.
2. Measure logic gates against same-figure MOS geometry and cross-check the
   resulting PDF-point scale against reviewed resistor/capacitor assets.
3. Regenerate affected evidence/assets/catalog outputs and add continuity and
   scale regression assertions.

## Validation

- deterministic PDF regeneration and manifest hash validation
- direct symbol fidelity comparisons and junction-focused raster inspection
- focused symbol/catalog tests and component palette preview test
- `corepack pnpm gate:affected -- --base origin/main`
- `corepack pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: authority/generator drift checks, focused tests, fidelity diff
- Affected gates: symbol unit tests, component-insert browser coverage, build
- Final gates: canonical `corepack pnpm ci:check` before mainline delivery
- Platform risks: Poppler raster differences, generated hashes, stale local
  browser servers, and unclassified visual-reference fixtures

## Test Impact

- Decision: tests-updated
- Contracts: visible primitives overlap at every intended electrical junction;
  gate scale is derived from a recorded PDF-point mapping; pins remain on-grid
- Primary checks: Razavi catalog geometry assertions and symbol fidelity runner

## Commit Intent

Commit as:

```text
fix(symbols): close logic gate joins and calibrate scale
```

## Outcome

Completed. The PDF extractor now terminates vertical NAND/inverter input leads
at the source-side body junction rather than the opposite end of the source
line. Negation bubbles use the source's 1.434 pt emphasis stroke, closing the
NAND/NOR body-to-bubble silhouette and preserving XNOR's composed bubble.

Direct hard IoU improved from `0.7172` to `0.8018` for inverter, from `0.8301`
to `0.9180` for NAND, and from `0.9064` to `0.9417` for NOR. AND remains
`0.9326` and XOR `0.9101`. Scale review retained the existing normalization:
NAND body height is `30.000872`, inverter `28.748801`, reviewed MOS active
height `25`, logic input pitch `20`, and resistor/capacitor/MOS pin span `40`.
The live review canvas places NAND, inverter, NMOS, resistor, and capacitor at
one zoom for human comparison.

Validation passed: deterministic 11/11 evidence regeneration; generator,
catalog, Agent, and MCP drift checks; 29 focused catalog tests; affected gates
with 1099 unit tests, hierarchy browser coverage, production build/smoke; and
canonical CI with 1099 unit and 183 browser tests on isolated port `43176`.
