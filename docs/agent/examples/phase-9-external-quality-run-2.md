# Phase 9 external quality run 2: chopper AFE

Status: `failed honestly; prescriptive remediation removed`

Run 2 used a new post-remediation 144-MOS hierarchical chopper AFE. All four
isolated tiers again passed electrical signature, lock, revision, placement,
Snapshot, render, query/helper, and diagnostic gates. The anonymous review was:

| Tier | Mean | Outcome |
| ---- | ---: | ------- |
| A    |  4.2 | baseline |
| B    |  4.0 | slight regression |
| C    |  2.8 | regression |
| D    |  3.2 | regression |

The exact compact evidence is
[`external-quality-chopper-afe-v1-report.json`](../../../fixtures/agent-layout-eval/external-quality-chopper-afe-v1-report.json).

The new port-label completeness rule fixed omissions but was applied
mechanically: repeated local labels, a very tall one-column parent, and dense
shared rails reduced readability. The no-Skill Agent instead used useful stage
headings and compact repetition. This validates the product principle that
knowledge must support Agent judgment rather than replace it with a layout
recipe.

The final remediation is outcome-based: make port/Net relations visible, then
choose the least cluttered trunk, boundary convention, or local labels; remove
redundant text; allow compact matrix wrapping; and ignore any card suggestion
that worsens the current render. Run 2 is retired from future pass/fail reuse.
