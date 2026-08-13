# Root Plan Audit

Snapshot: 2026-08-13. The root `plan/` directory is an operational queue, not
an archive. Completed plans with resolved experience are stored under
[`archived/2026-08/`](archived/2026-08/).

## Retained Work

| State                     | Count | Required disposition                                                              |
| ------------------------- | ----: | --------------------------------------------------------------------------------- |
| `active`                  |     4 | Confirm ownership and close only after its stated validation and log entry.       |
| `completed` + `none`      |    20 | Each awaits a later archive sweep; their commits and log entries are complete.    |
| `completed` + `candidate` |     5 | Human decides whether to extract, reject, or defer the experience signal.         |
| `superseded`              |     1 | Retain until its replacement is recorded, then archive.                           |
| legacy `proposed`         |     1 | Replace the invalid legacy state with `active`, `completed`, or `superseded`.     |
| missing metadata          |   121 | Audit against outcome text and Git evidence; never archive merely because of age. |

### Active

- `2026-08-11-transient-canvas-and-cache-bounds`
- `2026-08-12-ci-delivery-and-archive-governance`
- `2026-08-12-connectivity-recovery-c3d`
- `2026-08-12-integrate-razavi-bulk-latest-main`

### Commit-gated completion

- `2026-08-13-agent-contract-compaction`
- `2026-08-13-agent-contract-hardening`
- `2026-08-13-capitalize-citation-title`
- `2026-08-13-expand-routine-plan-pruning`
- `2026-08-13-hide-web-netlist-surface`
- `2026-08-13-integrate-ci-contract-cleanup`
- `2026-08-13-integrate-netlist-test-contract`
- `2026-08-13-local-validation-optimization`
- `2026-08-13-netlist-export-main-integration`
- `2026-08-13-netlist-export-system`
- `2026-08-13-plan-lifecycle-hygiene`
- `2026-08-13-prune-routine-plan-records`
- `2026-08-13-readme-citation`
- `2026-08-13-repository-tooling-consolidation`
- `2026-08-13-remove-compatibility-reexports`
- `2026-08-13-retire-legacy-annotation-protocol`
- `2026-08-13-rich-text-contract-consolidation`
- `2026-08-13-shorten-citation-title`
- `2026-08-13-scope-ci-by-change`
- `2026-08-13-test-contract-dedup`

### Completed plans awaiting an experience decision

- `2026-08-11-correct-closed-switch-pdf-crop`
- `2026-08-11-correct-common-razavi-assets`
- `2026-08-11-correct-pdf-derived-fidelity-baselines`
- `2026-08-12-web-agent-session-wa4`
- `2026-08-12-wp-r0-behavior-baseline`

### State correction queue

- `2026-08-12-vdd-power-rail` is `superseded`.
- `2026-08-08-wp-a1-model-drafting-anchor` uses the legacy invalid state
  `proposed` and needs an explicit disposition.

## Legacy Metadata Sweep

The 121 plans without a machine-readable state predate the current metadata
contract. Their current distribution is evidence, not a disposition: 25 have
an `Outcome` section, while 96 require reviewing their final intent, outcome,
and Git history. A follow-up target must classify each into one current state
before moving any of them. Do not bulk-rewrite their historical bodies.
