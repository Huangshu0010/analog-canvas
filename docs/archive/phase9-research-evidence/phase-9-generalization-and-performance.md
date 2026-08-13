# Phase 9 generalization and performance evidence

Date: 2026-08-07

## Checked large-Document run

The retired `generalization.mjs` program
builds a deterministic 128-transistor, eight-path stress Document with unequal
path lengths, explicit pin/Net membership, 392 Routes, 18 ports, shared rails,
and varied device parameters. It is deliberately not named after a known
fixture or presented as an analog performance model.

The run obtains a complete v2 Snapshot, dry-runs and commits generic Net edits,
refreshes revision 1, verifies the structural topology is unchanged, and renders
the final formal SVG. It makes zero v1 query calls and enables no helper. The
checked artifacts are:

- [`generalization-and-performance.json`](artifacts/generalization-and-performance.json)
- [`unseen-transistor-128.svg`](artifacts/unseen-transistor-128.svg)

The 128-instance Snapshot is 289,373 bytes (about 72,344 tokens using a
conservative bytes/4 estimate). The same complete schema at 500 instances is
1,126,592 bytes (about 281,648 tokens). Both remain below the accepted 4 MB
Snapshot limit without a region query, semantic chunk, or Layout Intent.

## Perturbation checks

The checked run proves:

- persisted collection order does not change the Snapshot hash;
- renaming instance/Net IDs preserves a name-independent structural signature;
- a deliberate symbol asymmetry changes that evidence signature;
- an unknown PDK namespace remains unresolved rather than borrowing SKY130
  semantics;
- the final v2 refresh reports revision 1, preserved topology, no visual
  diagnostics, and a formal render without editor overlays.

## Visual review

The generated page was inspected at full resolution. Device rows, local paths,
and left-side shared rails remain aligned and legible; unequal row lengths and
parameter variation do not disturb the repeated visual grammar. The fixture is
a scale/transport/edit/render acceptance case, not evidence that an Agent has
understood a novel 128-transistor analog function. That stronger claim requires
an externally supplied unseen circuit and a blind human readability review.

## Skill/package ablation boundary

[`skill-evaluation.mjs`](../../../tools/research/phase9/skill-evaluation.mjs)
checks the four guidance tiers, manifest links, owner/strength/trigger metadata,
and progressive-loading cost. The checked report is
[`skill-and-ablation-structure.json`](../../../fixtures/agent-layout-eval/skill-and-ablation-structure.json).

This deterministic check establishes that every tier retains the same hard
Snapshot/Edit Engine boundary and that the targeted large/CDAC knowledge set is
smaller than loading the whole library. It intentionally does not label static
document checks as Agent-quality or blinded-readability results. A model runner
and independent reviewer are required for that part of the Phase 9 research
gate; the reproducible input/result/anonymization contract is implemented by
[`external-quality-eval.mjs`](../../../tools/research/phase9/external-quality-eval.mjs).

## Optional-helper decision

No product helper is added. RLC finishes in four transactions and hierarchical
CDAC in eight across both Documents; the large stress run needs one four-edit
transaction. All runs complete with helpers disabled, and complete 500-instance
Snapshots fit the budget. These measurements do not justify the maintenance and
semantic risk of a topology classifier, query DSL, `place_array`, `draw_cdac`,
or Layout Intent compiler.
