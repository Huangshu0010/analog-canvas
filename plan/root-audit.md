# Root Plan Audit

Snapshot: 2026-08-18. The root `plan/` directory is the current operational
queue. Completed, resolved records live under
[`archived/2026-08/`](archived/2026-08/); independently reconstructible
routine records may be deleted under the retention rule in
[`README.md`](README.md).

## Retained queue

| State | Count | Required disposition |
| --- | ---: | --- |
| `completed` + `none` | 7 | `2026-08-18-schematic-hierarchy-v12`, `2026-08-18-plan-docs-retention`, and `2026-08-18-hierarchy-authoring-visual-h1` through `2026-08-18-hierarchy-authoring-visual-h5` await their normal archive passes. |
| `completed` + `candidate` | 17 | Human decides whether to extract, reject, or defer the experience signal. |
| `active` | 0 | No active target plan is awaiting completion. |
| legacy metadata missing | 71 | Audit each record against its Outcome, factual log, and Git evidence; do not infer completion from age. |

## Completed plans awaiting an experience decision

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

## 2026-08-18 retention sweep

- Reconciled 11 stale `active` markers whose delivery commits are already on
  `origin/main`, then archived their resolved records with the completed queue.
- Archived 119 completed, resolved non-routine records under `2026-08`.
- Deleted 18 independently reconstructible UI and delivery records after
  confirming their completed state, factual-log entries, and Git evidence.
- Kept all unresolved experience candidates and all legacy records without
  machine-readable metadata visible in the root queue.
