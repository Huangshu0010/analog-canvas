# Delivery Roadmap

The roadmap decomposes the accepted architecture into demonstrable phases.
Phases are ordered by dependency and exit gates, not by calendar estimates.

## Phase Index

| Phase | Plan                                                                                              | Status   | Primary outcome                                                            |
| ----: | ------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
|     0 | [`Contracts and Scaffold`](phase-0-contracts-and-scaffold.md)                                     | complete | Stable Project, Document, coordinate, Symbol, edit, and IR boundaries      |
|     1 | [`Core Editor Slice`](phase-1-core-editor-slice.md)                                               | complete | Manually place, move, save, reopen, and render a small schematic           |
|     2 | [`SPICE Import`](phase-2-spice-import.md)                                                         | complete | Import current fixtures into Documents without losing connectivity         |
|     3 | [`Connectivity and Routing`](phase-3-connectivity-and-routing.md)                                 | complete | Wire, explicit junction, crossing, flightline, stretch, and detach closure |
|     4 | [`Full SPICE Baseline`](phase-4-full-spice-baseline.md)                                           | complete | Complete SPICE3/ngspice structural compatibility and lossless round-trip   |
|     5 | [`Symbols and Visual Quality`](phase-5-symbols-and-visual-quality.md)                             | complete | Historical symbol pipeline; visual authority superseded by ADR 0011        |
|     6 | [`Agent API`](phase-6-agent-api.md)                                                               | complete | Safe `capabilities/query/transact/render` Agent integration                |
|     7 | [`Export and Hardening`](phase-7-export-and-hardening.md)                                         | complete | Recovery, performance, broader dialects, and production export             |
|     8 | [`Direct Manipulation and Manual Authoring`](phase-8-direct-manipulation-and-manual-authoring.md) | complete | Compact UI, manual placement, direct wiring, and automatic junctions       |
|     9 | [`Snapshot-Driven Agent Workflow`](phase-9-agent-reasoning-and-observability.md)                  | review   | Snapshot/Skill workflow implemented; external quality ablation remains     |

## Dependency Graph

```mermaid
flowchart LR
    P0["P0 Contracts"] --> P1["P1 Core Editor"]
    P0 --> P2["P2 SPICE Import"]
    P1 --> P3["P3 Connectivity + Routing"]
    P2 --> P3
    P2 --> P4["P4 Full SPICE"]
    P1 --> P5["P5 Symbols + Visual"]
    P3 --> P5
    P3 --> P6["P6 Agent API"]
    P5 --> P6
    P4 --> P7["P7 Export + Hardening"]
    P5 --> P7
    P6 --> P7
    P7 --> P8["P8 Direct Manipulation + Manual Authoring"]
    P8 --> P9["P9 Snapshot-Driven Agent Workflow"]
```

Phase 1 and Phase 2 may proceed in parallel after Phase 0. Phase 4 may proceed
in parallel with the later part of Phase 5. A downstream phase must not assume
an upstream contract is stable until the upstream exit gate is recorded.
Phase 8 is a post-v0.1 interaction redesign: it preserves the completed Phase
0-7 baseline and extends its contracts instead of rewriting their history.
Phase 9 implements the post-Phase-8 Agent workflow: the host supplies a complete
read-only Document Snapshot, a thin Skill governs the lifecycle, knowledge is
loaded on demand, and all writes remain typed transactions. It deliberately
adds neither a query language nor a mandatory Layout Intent/compiler layer.
Its deterministic product gates are complete; status remains `review` until an
external Agent runner and independent reviewer finish the declared quality
ablation/blind-readability gate.

## Phase Rules

- Each phase must produce a user-visible or deterministically inspectable
  outcome, not only internal abstractions.
- A phase may create several bounded targets under `plan/`; the roadmap file
  is not a substitute for target ownership and dirty-state handling.
- New cross-module contracts require a spec or ADR before dependent targets
  implement against them.
- Exit gates require evidence in tests, golden fixtures, generated artifacts,
  or recorded review. Confidence alone is not an exit gate.
- Out-of-scope work remains visible; it is not silently pulled into a phase.

Use [`phase.template.md`](phase.template.md) when a new phase or a replacement
phase is introduced.
