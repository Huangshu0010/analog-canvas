# Phase 9 held-out Flash ADC fixture

Status: `frozen after the Skill/knowledge set; external tier runs pending`

This fixture is the common unseen input for the external four-tier Agent
quality gate. It was added after the Phase 9 Skill and knowledge pages were
written, and those pages must not be tuned from its tier outputs before the
ablation is scored.

## Circuit boundary

The source is
[`circuit.spi`](../../../netlists/phase-9-heldout-flash-adc-4bit/circuit.spi),
with limitations recorded in its
[`README.md`](../../../netlists/phase-9-heldout-flash-adc-4bit/README.md). It is
a topology-only hierarchical 4-bit flash ADC, not a simulated performance
claim.

- `flash_cmp`: 9 reviewed SKY130 MOS instances, 10 Nets, and 6 ports;
- `flash_adc_4bit`: 16 ladder resistors, 15 comparator references, 36 Nets,
  and 21 ports;
- elaborated scale: 135 MOS instances plus the resistor ladder;
- unresolved/generic imported symbols: zero;
- import errors and initial diagnostics: zero.

The generated starting Project and exact import evidence are:

- [`heldout-flash-adc-4bit-start.icproj.json`](../../../fixtures/agent-layout-eval/heldout-flash-adc-4bit-start.icproj.json)
- [`heldout-flash-adc-4bit-import-report.json`](../../../fixtures/agent-layout-eval/heldout-flash-adc-4bit-import-report.json)
- [`heldout-flash-adc-4bit-task.md`](../../../fixtures/agent-layout-eval/heldout-flash-adc-4bit-task.md)

`pnpm phase9:heldout:check` reimports the source, checks hierarchy, symbol
resolution, connectivity counts, elaborated scale, Snapshot byte lengths and
topology hashes, then byte-compares both generated artifacts. The general SPICE
corpus test independently pins the source connectivity hash.

## Prepare the isolated run

Use a new output directory for every real model run:

```powershell
node scripts/phase-9-external-quality-eval.mjs prepare `
  --project fixtures/agent-layout-eval/heldout-flash-adc-4bit-start.icproj.json `
  --task fixtures/agent-layout-eval/heldout-flash-adc-4bit-task.md `
  --targeted docs/agent/knowledge/hierarchy-and-large-circuits.md,docs/agent/knowledge/pdk-and-symbols.md,docs/agent/knowledge/patterns/differential-pair.md,docs/agent/knowledge/patterns/current-mirror.md,docs/agent/knowledge/patterns/arrays-and-ladders.md `
  --out output/phase9-external-eval/heldout-flash-adc-4bit-v3
```

The prepared kit is runtime evidence and remains outside the tracked product
file flow. Each tier must be executed in an isolated Agent context with the
same declared provider, model, version, and decoding settings. Follow
[`phase-9-external-quality-gate.md`](phase-9-external-quality-gate.md) for the
result contract, finalization, anonymization, and independent scoring steps.

Do not inspect one tier's result while producing another, modify the frozen
contexts, enable optional helpers, call the v1 query path, or use the final
drawings to revise the knowledge documents before scores are frozen.

The local canonical prepared kit is
`output/phase9-external-eval/heldout-flash-adc-4bit-v3`. Its four result
directories are intentionally empty until independent runs are authorized. The
older local `v1` and `v2` directories predate the complete all-Document
Snapshot/render and executable typed-transaction contracts and must not be used
for the exit gate.
