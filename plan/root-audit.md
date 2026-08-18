# Root Plan Audit

Snapshot: 2026-08-17. The root `plan/` directory is an operational queue, not
an archive. Completed plans with resolved experience are stored under
[`archived/2026-08/`](archived/2026-08/).

## Retained Work

| State                     | Count | Required disposition                                                              |
| ------------------------- | ----: | --------------------------------------------------------------------------------- |
| `active`                  |     1 | PR #119 hierarchy delivery repair awaits its remote required checks.               |
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

## 2026-08-17 Library examples integration closure

`2026-08-17-merge-library-examples` is completed with resolved experience.
PR #109 rebased the Library example cards onto current `main`, passed the full
local and remote delivery gates, and merged as `cd1cddd`; it is eligible for
normal completed-plan retention handling.

## 2026-08-17 Examples tool-rail closure

`2026-08-17-examples-rail` is completed with resolved experience. PR #111
placed the Examples entry in the far-left tool rail, passed local and remote
delivery gates, and merged as `f7d961c`; it is eligible for normal completed-
plan retention handling.

## 2026-08-17 Editor interaction controller migration

`2026-08-17-editor-interaction-controller-migration` is completed on
`codex/app-transaction-module-layers`. Its five flat Hook extractions passed
the branch validation and ownership audit; it is eligible for normal completed
plan retention handling.

## 2026-08-17 Manual hierarchical Cell editing closure

`2026-08-17-manual-hierarchy-from-rectangle` is completed on main. Its
rectangle-to-Cell conversion and navigation behavior is retained during the
interaction-Hook integration target.

## 2026-08-17 Connected-Wire and Library stabilization closure

The connected Route edit stabilization and narrow Library browser timing
repairs are completed mainline work and remain part of this merge baseline.

## 2026-08-17 PR 117 CI repair

`2026-08-17-fix-pr117-ci` is locally validated and remains active on
`codex/app-transaction-module-layers`. It restores the merged connected-route
drag projection and refreshes the Linux MCP integrity pin; the repair is
awaiting its remote required-check result before PR #117 can merge.

## 2026-08-17 Net contract unification closure

`2026-08-17-net-contract-n4-repair-delivery` is completed on
`codex/net-contract-unification-plan`. Its entry repair, global-Net visible
connectivity semantics, current contract/user guidance, and branch validation
are recorded in `plan/log.md`; it is eligible for normal completed-plan
retention after commit evidence is recorded.

## 2026-08-17 Net contract named-authoring closure

`2026-08-17-net-contract-n5-named-net-planner` is completed on
`codex/net-contract-unification-plan`. The generic named-Net planner now owns
GUI Net-label rename-or-merge intent, while the raw transaction stays strict;
validation and commit evidence are recorded in `plan/log.md`.

## 2026-08-17 Net contract editor-normalizer closure

`2026-08-17-net-contract-n6-retire-editor-power-normalizer` is completed on
`codex/net-contract-unification-plan`. The editor no longer mutates loaded
power Nets through an implicit normalization effect; retained compatibility
behavior and validation are recorded in `plan/log.md`.

## 2026-08-17 Net contract repair-reference closure

`2026-08-17-net-contract-n7-repair-reference-closure` is completed on
`codex/net-contract-unification-plan`. Project-entry repair now has direct
regression evidence for every persisted source-Net reference class; validation
and commit evidence are recorded in `plan/log.md`.

## 2026-08-17 Net contract Agent named-authoring closure

`2026-08-17-net-contract-n8-agent-named-net-parity` is completed on
`codex/net-contract-unification-plan`. Semantic Agent naming now shares GUI
planner behavior while raw API transaction behavior remains strict; validation
and commit evidence are recorded in `plan/log.md`.

## 2026-08-17 Net contract acceptance-matrix closure

`2026-08-17-net-contract-n9-acceptance-matrix` is completed on
`codex/net-contract-unification-plan`. Repeated canonical Ground/VDD symbol
placement is directly covered through the normal proposal and transaction
boundary, including AVDD/DVDD separation; validation and commit evidence are
recorded in `plan/log.md`.

## 2026-08-17 Net contract roadmap closure

`2026-08-17-net-contract-n10-roadmap-closure` is completed on
`codex/net-contract-unification-plan`. The roadmap now records the compact
module split, explicit non-goals, and final branch verification; it is eligible
for normal completed-plan retention handling.

## 2026-08-17 Net contract legacy-compatibility retirement

`2026-08-17-net-contract-n11-retire-legacy-compat` is completed on
`codex/net-contract-unification-plan`. It supersedes the earlier compatibility
decision: no legacy power-normalization edit or Project-entry duplicate-Net
repair remains; normal authoring uses only current typed planners and explicit
merges. Validation and commit evidence are recorded in `plan/log.md`.

## Legacy Metadata Sweep

The first 50 oldest pre-metadata records were individually classified on
2026-08-13 from their intent/outcome, factual log, and Git path history. Thirty-nine
completed records with resolved experience were archived; eleven completed
records with an explicit human-review signal remain above as candidates. The
remaining 71 plans still require the same individual evidence review; do not
bulk-rewrite their historical bodies.
