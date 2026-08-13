# Root Plan Audit

Snapshot: 2026-08-13. The root `plan/` directory is an operational queue, not
an archive. Completed plans with resolved experience are stored under
[`archived/2026-08/`](archived/2026-08/).

## Retained Work

| State                     | Count | Required disposition                                                              |
| ------------------------- | ----: | --------------------------------------------------------------------------------- |
| `active`                  |     0 | No target is currently active in the root plan queue.                             |
| `completed` + `candidate` |     5 | Human decides whether to extract, reject, or defer the experience signal.         |
| missing metadata          |   121 | Audit against outcome text and Git evidence; never archive merely because of age. |

### Active

None.

### Completed plans awaiting an experience decision

- `2026-08-11-correct-closed-switch-pdf-crop`
- `2026-08-11-correct-common-razavi-assets`
- `2026-08-11-correct-pdf-derived-fidelity-baselines`
- `2026-08-12-web-agent-session-wa4`
- `2026-08-12-wp-r0-behavior-baseline`

## 2026-08-13 Root Closure

The completed technical, CI, migration, integration, and governance plans were
verified against their Outcome, factual log entry, and Git path history, then
moved to `archived/2026-08/`. The three routine README citation plans were
deleted after the same verification because their independent commits and log
entries reconstruct the full record. The formerly active plans had completed
Outcomes and corresponding implementation commits; the legacy WP-A1 proposal
was confirmed as completed from its A1a/A1b/schema-gate log evidence; and the
superseded VDD plan's drawn-rail replacement is already archived.

## Legacy Metadata Sweep

The 121 plans without a machine-readable state predate the current metadata
contract. Their current distribution is evidence, not a disposition: 25 have
an `Outcome` section, while 96 require reviewing their final intent, outcome,
and Git history. A follow-up target must classify each into one current state
before moving any of them. Do not bulk-rewrite their historical bodies.
