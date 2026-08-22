---
status: completed
experience: none
---

# Razavi Logic-Gate Alignment

## Goal

Replace the hand-composed logic-gate artwork with hash-pinned Razavi textbook
PDF vector evidence, align the existing inverter/AND/OR/NAND/NOR symbols, and
add reviewed XOR/XNOR symbols derived through the same family generator.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/razavi-logic-gate-alignment...origin/main
```

The dedicated worktree is clean and starts at `origin/main`
`a33a01e8fd902bb146a64efd84e0bb16751b943f`. The user's dirty main worktree
contains VDD-rail and capacitor-semantics work and is isolated from this target.

Owned paths:

- `tools/pdf-vector-extract/extract-razavi-logic-gates.py` and its README entry
- `fixtures/visual-reference/razavi-reference-v1/*logic-gate*`, direct gate
  evidence/witness files, `manifest.json`, and `fidelity-targets.json`
- `scripts/generate-razavi-logic-gate-assets.mjs` and related package scripts
- `tools/calibration/razavi/symbol-fidelity-diff.mjs` and its README entry;
  this symbol-only entry point replaces no retired circuit/formal-scene tool
- `packages/symbols/assets/razavi-v1/{inverter,and-gate,or-gate,nand-gate,nor-gate,xor-gate,xnor-gate}.symbol.json`
- Razavi catalog source/generated output and focused symbol tests
- editor palette/catalog/count tests and generated Agent/MCP catalog artifacts
- this target plan and `plan/log.md`

Read-only external evidence:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`

Shared contracts: Razavi authority manifest/hash validation, PDF-vector
evidence schema, 10-unit pin grid, product-symbol catalog generation, palette
eligibility, and fidelity target registry.

## Work

1. Extract direct native-vector evidence and direct PDF crop witnesses for
   inverter, AND, NAND, NOR, and XOR from Figures 16.2, 16.24, and 16.25.
2. Record normalized family geometry. Generate OR by removing NOR's output
   bubble and XNOR by adding the reviewed family bubble to XOR; keep all pin
   anchors on the existing 10-unit grid.
3. Generate all seven Symbol DSL assets, update catalog provenance, register
   XOR/XNOR in runtime, GUI, and Agent-facing catalogs, and add fidelity targets.
4. Compare the five directly evidenced symbols against their PDF witnesses,
   structurally verify the two derived compositions, inspect spatial diffs,
   and retain source-coordinate geometry rather than metric-only shifts.

## Validation

- PDF extractor deterministic regeneration and mismatched-source rejection
- `corepack pnpm symbols:razavi-logic:check`
- `corepack pnpm symbols:razavi:check`
- focused symbol/catalog, authority, editor catalog/palette tests
- package builds consumed by the fidelity runner
- five registered direct fidelity comparisons, OR/XNOR composition tests, and
  diff inspection
- `corepack pnpm gate:preflight -- --base origin/main`
- `corepack pnpm gate:affected -- --base origin/main`
- `corepack pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate-review, static contracts, generated-artifact checks, and
  test-impact
- Affected gates: focused workspace unit tests, component-insert browser test,
  package builds, authority validation, and fidelity comparisons
- Final gates: `corepack pnpm ci:check` before mainline delivery; required
  GitHub checks after pushing the review branch
- Platform risks: committed PNG hashes and Poppler output, generated catalog
  drift, Linux path behavior in the extractor, browser palette counts, and the
  gate planner's full fallback for visual-reference fixture paths

## Test Impact

- Decision: tests-updated
- Contracts: source provenance and hashes; deterministic direct/derived gate
  geometry; seven gate IDs and pin orders; inversion bubble composition;
  reviewed palette eligibility; fidelity target completeness
- Primary checks: PDF extractor tests/check mode, Razavi authority tests,
  `packages/symbols/src/razavi-catalog.test.ts`, editor symbol catalog and
  shapes-panel tests, component-insert browser coverage

## Commit Intent

Commit as:

```text
feat(symbols): align Razavi logic gate family
```

## Outcome

Completed. The Razavi catalog now uses native textbook-vector evidence for
inverter, AND, NAND, NOR, and XOR. OR is generated from the evidenced NOR body
without its bubble; XNOR is generated from the evidenced XOR body with the
reviewed NOR-family bubble. All seven remain on the existing electrical pin
grid and are registered in the GUI, Agent catalog, and MCP resources.

Direct symbol fidelity results (hard IoU) are: inverter `0.7172`, AND
`0.9326`, NAND `0.8301`, NOR `0.9064`, and XOR `0.9101`. The extractor
reproduced all 11 committed evidence outputs byte-for-byte and rejected a
non-authority input by SHA-256.

Validation passed: generator/catalog/Agent/MCP drift checks; 42 focused unit
tests plus the authority tests; component-insert browser tests; full affected
gates (22 component-insert, 11 hierarchy, 1 Agent, 90 editor, 1097 unit tests,
build and production smoke); and canonical `ci:check` (1097 unit tests, 183
browser tests, release verification) on isolated port `43173`. The first local
full-CI browser attempt reused an unrelated old GUI on default port `4173` and
saw its 30-item catalog; rerunning the failed scenario and canonical CI with
`ICM_E2E_ISOLATED=1` confirmed the new 32-item catalog and passed.
