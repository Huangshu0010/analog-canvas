# Root Plan Audit

Snapshot: 2026-08-17. The root `plan/` directory is an operational queue, not
an archive. Completed plans with resolved experience are stored under
[`archived/2026-08/`](archived/2026-08/).

## Retained Work

| State                     | Count | Required disposition                                                              |
| ------------------------- | ----: | --------------------------------------------------------------------------------- |
| `active`                  |     0 | No active root plan remains.                                                       |
| `completed` + `none`      |    42 | Verify commit/log evidence, then archive according to routine retention policy.   |
| `completed` + `candidate` |    17 | Human decides whether to extract, reject, or defer the experience signal.         |
| missing metadata          |    71 | Audit against outcome text and Git evidence; never archive merely because of age. |

### Completed plans awaiting an experience decision

- `2026-08-14-current-contract-clean-break`
- `2026-08-11-correct-closed-switch-pdf-crop`
- `2026-08-11-correct-common-razavi-assets`
- `2026-08-11-correct-pdf-derived-fidelity-baselines`
- `2026-08-12-web-agent-session-wa4`
- `2026-08-12-wp-r0-behavior-baseline`
- `2026-08-07-execute-phase-8`
- `2026-08-07-expand-wire-editing`
- `2026-08-07-integrate-interaction-redesign`
- `2026-08-07-razavi-canon-into-skill-manifest`
- `2026-08-07-record-rule-guided-agent-layout`
- `2026-08-07-render-faithful-hierarchical-ports`
- `2026-08-08-drafting-runtime-final-repair`
- `2026-08-08-editor-browser-crypto-regression`
- `2026-08-08-four-layer-agent-guidance`
- `2026-08-08-razavi-existing-mos-migration`
- `2026-08-08-razavi-mos-canonical-arrow-diff`

## 2026-08-13 Root Closure

The completed technical, CI, migration, integration, and governance plans were
verified against their Outcome, factual log entry, and Git path history, then
moved to `archived/2026-08/`. The three routine README citation plans were
deleted after the same verification because their independent commits and log
entries reconstruct the full record. The formerly active plans had completed
Outcomes and corresponding implementation commits; the legacy WP-A1 proposal
was confirmed as completed from its A1a/A1b/schema-gate log evidence; and the
superseded VDD plan's drawn-rail replacement is already archived.

## 2026-08-15 Label-placement closure

`2026-08-15-fix-label-gap-rotation` is completed with resolved experience.
Its delivered commit, factual log entry, and remote merge evidence are present;
it is eligible for normal completed-plan retention handling.

## 2026-08-15 Placement-mirror and grid-toggle closure

`2026-08-15-placement-mirror-grid-toggle` passed its remote gate and merged as
PR #72; its completed delivery record is present.

## 2026-08-17 Current protocol baseline closure

`2026-08-17-current-protocol-baseline` is completed with resolved experience.
ADR 0022, current specs, generated Agent knowledge, deterministic drift tests,
and branch-verification evidence are present; the local target commit is ready
for normal completed-plan retention handling.

## 2026-08-17 Rolling Project compatibility closure

`2026-08-17-v10-v11-project-compatibility` is completed with resolved
experience. ADR 0023, the direct model adapter, formal-file and recovery
integration, synthetic compatibility tests, browser evidence, and branch-wide
verification are present; it is eligible for normal completed-plan retention
handling after commit evidence is recorded.

## 2026-08-17 Device protocol and compatibility architecture planning closure

`2026-08-17-device-protocol-compatibility-architecture` is a completed
planning record with resolved experience. It defines the behavior-preserving
module boundaries and bounded compatibility policy; ADR 0024 accepted that
architecture before the foundation implementation began.

## 2026-08-17 Device protocol foundation closure

`2026-08-17-device-protocol-foundation` is completed with resolved experience.
The single device descriptor registry, current-only modular model, bounded
Project protocol adapter, editor/recovery migration, focused browser evidence,
and branch-wide verification are present; it is eligible for normal completed
plan retention after commit evidence is recorded.

## 2026-08-17 Protocol architecture gap closure

`2026-08-17-protocol-architecture-gap-closure` is completed with resolved
experience. It reconciles the previously delivered foundation with the accepted
fine-grained device, model-schema, and Project-protocol architecture, while
retaining the current fixture and single-adapter compatibility policy.

## 2026-08-17 Project protocol release-contract repair

`2026-08-17-fix-protocol-release-contract` is completed with resolved
experience. It restores the release scripts' Project persistence imports after
the Project-protocol boundary split; local release verification passed and the
target is awaiting commit and remote required-check evidence.

## 2026-08-17 Project protocol MCP checksum refresh

`2026-08-17-refresh-protocol-mcp-checksum` is completed with resolved
experience. It aligns the Linux MCP artifact integrity pin with the Project
protocol release candidate; local release verification passed and remote Linux
validation remains the delivery gate.

## 2026-08-17 Routing protocol unification execution

`codex/routing-protocol-unification` starts from current `origin/main` in an
isolated worktree. The completed behavior-baseline target restores direct
geometry characterization before the active read, edit, and attachment
clean-cut targets. No legacy routing surface is yet removed.

## Legacy Metadata Sweep

The first 50 oldest pre-metadata records were individually classified on
2026-08-13 from their intent/outcome, factual log, and Git path history. Thirty-nine
completed records with resolved experience were archived; eleven completed
records with an explicit human-review signal remain above as candidates. The
remaining 71 plans still require the same individual evidence review; do not
bulk-rewrite their historical bodies.
