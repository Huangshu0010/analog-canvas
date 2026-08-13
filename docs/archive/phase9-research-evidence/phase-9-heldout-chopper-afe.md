# Phase 9 held-out 8-channel chopper AFE

Status: `frozen historical input; retired from future pass/fail reuse`

This is the second common unseen input for the external four-tier Agent quality
gate. It was created only after the first Flash-ADC run was scored and the
general port-label/text rules were frozen. The Skill and knowledge pages must
not be revised from this circuit or its tier outputs before run 2 is scored.

The topology-only source and limitations are recorded in:

- [`circuit.spi`](../../../netlists/phase-9-heldout-chopper-afe-8ch/circuit.spi)
- [`README.md`](../../../netlists/phase-9-heldout-chopper-afe-8ch/README.md)

The circuit contains one 18-MOS `chopper_channel` definition and eight parent
references, for 144 elaborated MOS instances. The child exposes differential
inputs/outputs, complementary clocks, bias, and power. The top exposes 32
channel signal ports plus five shared clock/bias/power ports. It has no resistor
ladder and is structurally distinct from run 1.

Pinned generated evidence:

- [`heldout-chopper-afe-8ch-start.icproj.json`](artifacts/heldout-chopper-afe-8ch-start.icproj.json)
- [`heldout-chopper-afe-8ch-import-report.json`](artifacts/heldout-chopper-afe-8ch-import-report.json)
- [`heldout-chopper-afe-8ch-task.md`](artifacts/heldout-chopper-afe-8ch-task.md)

The retired held-out generator pinned hierarchy, port/Net counts, zero generic
symbols/import errors, 144-device elaborated scale, Snapshot sizes/hashes, and
byte-identical generated artifacts. The main SPICE corpus independently pins
the 26 direct instances and connectivity hash.

Prepare run 2 in a new directory:

```powershell
node tools/research/phase9/external-quality-eval.mjs prepare `
  --project fixtures/agent-layout-eval/heldout-chopper-afe-8ch-start.icproj.json `
  --task fixtures/agent-layout-eval/heldout-chopper-afe-8ch-task.md `
  --targeted docs/agent/knowledge/hierarchy-and-large-circuits.md,docs/agent/knowledge/pdk-and-symbols.md,docs/agent/knowledge/patterns/differential-pair.md,docs/agent/knowledge/patterns/current-mirror.md,docs/agent/knowledge/patterns/switching-and-sampling.md,docs/agent/knowledge/patterns/arrays-and-ladders.md `
  --out output/phase9-external-eval/heldout-chopper-afe-8ch-v1
```

Use the same model/settings and isolation rules as run 1. Efficiency fields are
runner-only estimates, so run 2 can pass only through blinded-readability
non-regression plus a real readability improvement.
