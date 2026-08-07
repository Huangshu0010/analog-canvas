# Phase 9 external quality run 1: Flash ADC

Status: `failed honestly; guidance revised; fixture retired from future gates`

The first real four-tier isolated run used the post-freeze hierarchical 4-bit
Flash ADC. All tiers used the same model/settings, API v2 runner, starting
Project, and hard contract. Finalization independently proved unchanged
electrical/lock state, complete final Snapshots, placed instances/ports,
per-Document formal renders, zero query/helper use, and zero final diagnostics.

The independent anonymous review produced:

| Tier | Guidance                    | Mean | Hard invariants | Result |
| ---- | --------------------------- | ---: | --------------- | ------ |
| A    | API contract only           |  4.0 | pass            | base   |
| B    | thin Skill                  |  3.8 | pass            | regress |
| C    | Skill + core knowledge      |  4.8 | pass            | improve |
| D    | Skill + full routed knowledge | 2.6 | pass           | regress |

The gate failed because every guided tier must be at least as readable as A.
The failure is not hidden or re-scored. The pinned compact report is
[`external-quality-flash-adc-v3-report.json`](../../../fixtures/agent-layout-eval/external-quality-flash-adc-v3-report.json).

## What the review found

- C made supplies, bias, inputs, outputs, ladder taps, and repeated hierarchy
  ports locally explicit and was the strongest result.
- B retained clear hierarchy but relied partly on headings/detached power labels.
- D left common hierarchy pins as unexplained stubs, relied on prose for hidden
  connections, used distracting tap detours, and emitted corrupted caption
  glyphs.

The response is a general rule, not a Flash-ADC coordinate recipe: every
Document port and every disconnected label-based Net branch must be visible at
the point of use; captions cannot substitute for connectivity expression; and
generated text must survive formal rendering. The Skill and relevant expression,
routing, hierarchy, and array pages now carry those checks.

This Flash ADC is retired from pass/fail reuse. A new held-out circuit must be
created only after the revised guidance freezes, and the next four tiers must
start from that new circuit without seeing this run's layouts.
