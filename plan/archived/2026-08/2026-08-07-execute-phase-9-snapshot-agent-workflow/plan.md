---
status: completed
experience: none
---

# Execute Phase 9 Snapshot-Driven Agent Workflow

## Goal

Fully implement the proposed Phase 9 outcome: a deterministic complete
Document Snapshot, a governing circuit-layout Skill plus on-demand knowledge,
revision-safe typed editing, actionable diagnostics, human handoff, measured
optional acceleration only where justified, and generalization/performance
evidence across RLC, CDAC, and an unseen 100+ transistor circuit.

## Dirty-State Decision

The worktree is dirty from several preceding user-requested targets:

- manual wire endpoint/Junction deletion and symbol-grid fidelity in the
  editor, symbol builtins/schema, specifications, and visual goldens;
- faithful hierarchical-port import, transient symbol resolution, rendering,
  editor resolver construction, and related corpus/goldens;
- RLC/CDAC Agent-layout recipes and generated artifacts;
- the Phase 9 architecture/roadmap discussion documents and shared log.

Their target plans record outcomes and ownership. Phase 9 treats those changes
as the current integration baseline but will not overwrite or reformat their
paths incidentally. Initial implementation owns clean Agent API/derived/docs/
Skill/evaluation paths. Before Phase 9 edits an overlapping dirty editor,
symbol, SPICE, renderer, fixture, or `plan/log.md` path, this plan must be
updated to claim the focused lines/files and the preceding focused validation
must establish that target as a stable baseline.

## Initial Owned Files

- `packages/agent-adapter/**`
- focused clean additions under `packages/derived/**`
- focused clean additions under `packages/edit-engine/**`
- `docs/adr/0007-snapshot-driven-agent-workflow.md`
- `docs/adr/README.md`
- `docs/specs/agent-api.md`
- `docs/specs/README.md`
- new Agent Snapshot schemas/artifacts generated from the adapter
- `fixtures/agent-api/**` for checked v1/v2 request examples and generated
  request/response/OpenAPI artifacts
- root `package.json` only for dependency-aware Agent API artifact builds
- `skills/circuit-layout/**`
- `docs/agent/knowledge/**`
- `docs/agent/examples/phase-9-*.md`
- `fixtures/agent-layout-eval/**`
- new Phase 9 validation scripts under `scripts/`
- a new post-knowledge-freeze topology-only held-out fixture under
  `netlists/phase-9-heldout-flash-adc-4bit/` plus its generated starting Project
  and task under `fixtures/agent-layout-eval/`; it is not used to revise the
  Skill or knowledge before the external ablation
- after the first external run failed and its remediation rules freeze, a
  second topology-only held-out fixture under
  `netlists/phase-9-heldout-chopper-afe-8ch/`, its generator, task, starting
  Project, import/corpus evidence, and isolated evaluation outputs; the revised
  Skill/knowledge must not be tuned from this second circuit before scoring
- after the second external run failed and the outcome-based remediation
  freeze, a structurally different feedback-loop held-out fixture under
  `netlists/phase-9-heldout-differential-ring-8stage/`, its generator, task,
  starting Project, import/corpus evidence, and isolated evaluation outputs;
  the Skill/knowledge remains frozen until this third circuit is scored
- `fixtures/agent-layout-eval/**` for checked vertical-trial inputs, traces, and
  reports
- `docs/agent/knowledge-and-skill-plan.md`
- `docs/agent/rule-guided-layout-architecture.md`
- `docs/overall-product-plan.md` for replacing the superseded query-first Agent
  section with the implemented Snapshot v2 boundary
- `docs/roadmap/phase-9-agent-reasoning-and-observability.md`
- `docs/agent/README.md` and `docs/roadmap/README.md` only for Phase 9 indexes
- `plan/2026-08-07-execute-phase-9-snapshot-agent-workflow/plan.md`
- `plan/2026-08-07-record-rule-guided-agent-layout/plan.md`

## Initially Read-Only Dirty Paths

- `apps/editor/**`
- `packages/symbols/**`
- `packages/spice/**`
- `packages/render-svg/**`
- existing modified visual/SPICE fixtures
- existing RLC/CDAC recipes and generated artifacts
- other target plans
- `plan/log.md` until final integration ownership is recorded

## Integration Ownership Added After First Vertical Trial

The 2026-08-07 full workspace build and the focused Snapshot/API tests passed
with the preceding dirty symbol/import baseline. The first checked vertical
trial then confirmed that reviewed SKY130 normalization and generic symbol/port
edits are required for a legal v2 workflow. Phase 9 therefore owns only focused
PDK-registry/import-normalization additions in `packages/symbols/**` and
`packages/spice/**`, plus the corresponding `packages/edit-engine/**`, Agent
adapter, specification, and test changes. Existing Visio symbol geometry,
hierarchical-block rendering, and unrelated importer behavior remain preserved.

The full release gate later exposed stale Phase 5/7 dense-analog routes after
the preceding target moved MOS drain/source pins from x=15 to x=20 and restored
the migrated arrow. Phase 9 integration therefore also owns the four focused
route/Junction coordinate updates in the dense-analog Project and regenerated
Phase 5/7 visual/export goldens. No circuit topology or unrelated fixture
geometry is changed.

## Shared Dependencies

- Accepted Project/Document, Agent API v1, Edit Engine, connectivity, Symbol
  Resolver, and render contracts.
- Current uncommitted but validated manual-wire and hierarchical-port changes.
- Existing Agent-layout runner and RLC/CDAC artifacts as baseline evidence.
- The single `.icproj` persistence boundary and no-MCP API decision.

## Expected Work

1. Record the no-Skill/current-API baseline and freeze Snapshot/API/Skill
   compatibility in an ADR and accepted spec revision.
2. Implement a complete deterministic read-only Project Index and Document
   Snapshot with bidirectional pin/Net mapping, full route/presentation facts,
   diagnostics, stable hashing, limits, and v1 compatibility.
3. Implement the thin `circuit-layout` Skill, core knowledge, initial pattern
   cards, and compatibility/quality checks.
4. Run Snapshot-driven RLC, CDAC, and unseen/large-circuit vertical traces and
   classify every failure by owning layer.
5. Update this plan, then close confirmed PDK/edit/diagnostic/hierarchy/handoff
   gaps without overwriting preceding dirty work.
6. Add optional helper/generator behavior only if trace measurements satisfy
   the documented entry gate.
7. Complete ablation, perturbation, payload/performance, GUI/Agent parity,
   visual review, full regression, documentation, and factual logging.
8. Package the optional external quality study as a reproducible four-tier
   evaluation kit with isolated context manifests, result contracts, hard
   invariant validation, anonymous render mapping, score aggregation, and a
   deterministic pipeline self-test. Actual model runs and independent scores
   remain external evidence and must not be synthesized by the harness.
9. Freeze a new hierarchical 4-bit flash-ADC topology-only held-out circuit
   after the knowledge set, verify its imported hierarchy/symbol/connectivity
   facts, and prepare it as the common external evaluation input. Do not tune
   knowledge cards against its eventual tier outputs. Treat real-model scores as
   research evidence, not as a dependency of the flat product workflow.

## Architectural Guardrails

- Treat the Agent as the semantic reasoning/layout layer; do not encode its
  temporary decomposition or plan as a required `LayoutIntent` or file.
- Deliver the selected Document's complete structured Snapshot instead of
  growing v1 query into a region/topology/changes language.
- Keep Project Index navigation separate from Document reasoning: index first,
  then one complete Snapshot for each chosen Document.
- Build the governing Skill and initial knowledge concurrently with Snapshot,
  and run the first vertical trials before broad PDK/edit/diagnostic/helper
  expansion.
- Keep runtime documentation two-part: lifecycle Skill plus progressively
  loaded circuit knowledge. Specs, examples, fixtures, and evaluation remain
  engineering support material, not additional Agent workflow layers.
- Add programmatic capability only for hard correctness, generic actions,
  observable feedback, or a measured mechanical bottleneck. Do not move
  ambiguous circuit interpretation out of the Agent merely to make it typed.

## Validation

- Frozen install and formatting for every owned code/document path.
- ADR/spec/schema artifact compatibility checks.
- Focused Agent Snapshot/API/Edit Engine/derived tests, then workspace
  typecheck and tests as contracts broaden.
- Snapshot topology consistency, deterministic hash/order, read-only boundary,
  permission, revision, payload/token, and 100/500-instance performance checks.
- Skill/reference link, compatibility, rule-owner, package, example, and
  progressive-loading checks.
- Reproducible RLC, CDAC, unseen 100+ transistor, stale-revision, unknown-PDK,
  lock, and diagnostic traces.
- A/B/ablation and renamed/reordered/asymmetric/equivalent-input tests.
- External ablation kit self-test plus validation that incomplete or
  topology-changing tier results cannot produce a passing blind-review report.
- Focused and then full Playwright flows when editor handoff/navigation enters
  scope; reviewed PNG/SVG artifacts where visual behavior changes.
- Existing reference, symbol, import, export, performance, release, and Phase 8
  gates in proportion to changed shared contracts.
- `git diff --check`, intended-diff review, and final
  `git status --short --branch`.

## Completion Evidence Required

- Every Phase 9 acceptance scenario has a checked fixture, test, trace, render,
  or measured report.
- All explicit Snapshot fields and bidirectional invariants are covered.
- The core workflow succeeds with optional helpers disabled.
- Deterministic API/package A/B gates pass; external visual ablation failures are
  recorded factually and do not become hidden product dependencies.
- Concurrent preceding-target changes remain present and pass their relevant
  checks after Phase 9 integration.
- `plan/log.md` records the final factual outcome and commit status.

## Commit Intent

Commit as a coherent Phase 9 implementation after the full exit gate:

```text
Complete snapshot-driven Agent workflow
```
