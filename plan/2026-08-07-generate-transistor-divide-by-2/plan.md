# Generate the SKY130 Transistor Divide-by-Two Schematic

## Goal

Generate a fast, editable Razavi-style top-level schematic from
`sky130-transistor-divide-by-2/circuit.spi` through the headless typed-edit
pipeline while preserving the source hierarchy and transistor connectivity.

## Dirty-State Note

The branch is ahead by the preceding generated-buffer commit. Existing dirty
documentation and OTA paths belong to other work and do not overlap this
target. They remain untouched and unstaged.

## Owned Files

- `plan/2026-08-07-generate-transistor-divide-by-2/plan.md`
- `netlists/sky130-transistor-divide-by-2/agent-layout.mjs`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2.icproj.json`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2.svg`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2.png`
- `netlists/sky130-transistor-divide-by-2/agent-divide-by-2.pdf`
- `packages/symbols/src/hierarchical-block.ts`
- `packages/symbols/src/hierarchical-block.test.ts`
- `plan/log.md` for the factual completion entry only

## Read-Only Files

- `netlists/sky130-transistor-divide-by-2/circuit.spi`
- generator, parser, model, symbol, routing, diagnostic, and exporter code

## Shared Dependencies

- SPICE subcircuit hierarchy and positional pin contracts
- project hierarchical symbols and reviewed NMOS presentation
- presentation-only implicit-supply variant for hierarchical blocks
- typed transactions, formal exporters, and derived diagnostics

## Expected Work

1. Lay out the top-level divider by functional signal flow.
2. Generate the editable Project and preview exports under unique names.
3. Verify hierarchy, topology, routing closure, and rendered legibility.
4. Keep hierarchical VDD/VSS membership canonical while suppressing those
   repetitive block pins in the selected functional top-level presentation.

## Validation

- Headless generator succeeds.
- Canonical Project round-trip and source-topology assertions pass.
- Zero flightlines; inspect crossings and visual diagnostics explicitly.
- Inspect the generated PNG.
- Focused hierarchical-symbol and derived-connectivity tests.
- `git diff --check`
- `git status --short --branch`

## Experience Signal (for human review)

## Commit Intent

```text
feat(fixtures): add agent-generated divide-by-two schematic
```

## Outcome

- Generated an editable seven-Document Project and formal top-level SVG, PNG,
  and PDF without using the GUI.
- The source hierarchy remains intact; the top-level view contains 8 placed
  instances, 10 Nets, 24 Routes, 9 Junctions, and 15 annotations.
- Added an opt-in hierarchical `implicit-supplies` presentation variant. It
  hides repeated block-level supply pins only; canonical VDD/VSS Net terminal
  membership is unchanged.
- Canonical parsing and topology checks passed with 0 flightlines, 0 visual
  diagnostics, and 20 derived crossing records. Several crossing records are
  same-Net route joins; the remaining feedback/reset crossings are visible in
  the intentionally fast functional top-level view.
- The final PNG was inspected after replacing the initially congested global
  supply tree with implicit hierarchical supplies.
