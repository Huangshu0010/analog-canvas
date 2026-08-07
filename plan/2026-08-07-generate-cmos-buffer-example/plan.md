# Generate a Two-Stage CMOS Buffer Example

## Goal

Generate, through the headless Agent typed-edit pipeline, a compact Razavi-style
schematic that is neither a CDAC nor an OTA. Use the existing `mixed_mos_cell`
SPICE fixture and preserve its complete MOS connectivity.

## Dirty-State Note

The worktree already contains documentation and OTA-layout work owned by prior
targets. Those paths do not overlap this target. This target owns only the new
buffer recipe, its generated exports, and this plan; all pre-existing dirty
paths remain untouched.

## Owned Files

- `plan/2026-08-07-generate-cmos-buffer-example/plan.md`
- `netlists/mixed-device-acceptance/razavi-mos-buffer-layout.mjs`
- `netlists/mixed-device-acceptance/razavi-mos-buffer.icproj.json`
- `netlists/mixed-device-acceptance/razavi-mos-buffer.svg`
- `netlists/mixed-device-acceptance/razavi-mos-buffer.png`
- `netlists/mixed-device-acceptance/razavi-mos-buffer.pdf`

## Read-Only Files

- `netlists/mixed-device-acceptance/circuit.spi`
- `netlists/mixed-device-acceptance/models.inc`
- `tools/agent-layout/generate.mjs`
- existing OTA recipes and exports

## Shared Dependencies

- SPICE parser and `mixed_mos_cell` terminal ordering
- typed transaction/edit engine
- built-in reviewed NMOS/PMOS symbols and `textbook-3terminal` presentation
- SVG/PNG/PDF exporters and visual diagnostics

## Expected Work

1. Add a deterministic layout recipe for two cascaded CMOS inverters.
2. Generate a uniquely named editable Project and preview exports.
3. Assert preserved topology, complete routing, and zero visual diagnostics.

## Validation

- Run the headless layout generator successfully.
- Inspect the generated PNG.
- Verify canonical Project parsing plus zero flightlines, crossings, and visual diagnostics.
- `git diff --check`
- `git status --short --branch`

These checks cover the generated artifact and its electrical/visual closure
without rerunning unrelated repository suites.

## Experience Signal (for human review)

## Commit Intent

Commit as:

```text
feat(fixtures): add agent-generated CMOS buffer schematic
```

## Outcome

- Generated the editable Project plus SVG, PNG, and PDF in one headless run.
- The target Document contains 4 placed MOS instances, 5 Nets, 20 Routes, 8
  Junctions, and 9 annotations.
- Canonical Project parsing passed; MOS D/G/S/B membership was preserved.
- Derived result: 0 flightlines, 0 crossings, and 0 visual diagnostics.
- The exported PNG was visually inspected and shows two clear cascaded CMOS
  inverter stages with explicit BIT, NBIT, BOT, VDD, and VSS structure.
