---
status: completed
experience: none
---

# Legacy Plan Metadata Sweep: Batch 1

## Goal

Classify the first 25 oldest root plans that predate machine-readable lifecycle
metadata, reducing the active planning surface without fabricating history.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/local-validation-optimization...origin/codex/local-validation-optimization [ahead 1]
```

The worktree is clean after the preceding root-closure commit. This batch owns
only the 25 plans listed below, their factual audit index, and this target's
record. It does not modify any current product, CI, test, archive, or
experience-candidate content.

- `2026-08-07-agent-routing-boundary-adr`
- `2026-08-07-agent-routing-expander-package`
- `2026-08-07-checkpoint-integrated-development`
- `2026-08-07-close-authoring-fidelity-gaps`
- `2026-08-07-complete-cdac-hierarchy-layout`
- `2026-08-07-defer-automatic-router`
- `2026-08-07-editor-text-label-hit-fixes`
- `2026-08-07-execute-phase-8`
- `2026-08-07-execute-phase-9-snapshot-agent-workflow`
- `2026-08-07-expand-wire-editing`
- `2026-08-07-hidden-mos-terminal-correctness`
- `2026-08-07-integrate-interaction-redesign`
- `2026-08-07-keep-mos-arrow-in-three-terminal-variant`
- `2026-08-07-local-power-textbook-cdac-layout`
- `2026-08-07-move-stretches-connected-routes`
- `2026-08-07-prototype-flattened-cdac-view`
- `2026-08-07-razavi-canon-into-skill-manifest`
- `2026-08-07-razavi-rv4-schematic-typography`
- `2026-08-07-razavi-rv5-semantic-nodes-annotations`
- `2026-08-07-razavi-rv6a-core-analog-evidence`
- `2026-08-07-record-rule-guided-agent-layout`
- `2026-08-07-refine-default-schematic-style`
- `2026-08-07-render-faithful-hierarchical-ports`
- `2026-08-07-routing-quality-metrics`
- `2026-08-07-transact-protocol-self-consistency`
- `plan/root-audit.md`
- `plan/log.md`
- `plan/2026-08-13-legacy-plan-metadata-batch-1/plan.md`

Read-only and shared dependencies:

- Read-only: `plan/archived/`, `docs/experience/`, all non-batch root plans,
  product files, current documentation, and Git history.
- Shared: plan retention policy. Architecture, ADR, migration, CI, release,
  deployment, integration, and unresolved-decision records are archived rather
  than deleted. Evidence gaps remain in the root queue.

## Work

1. For every batch plan, inspect its final intent/outcome, `plan/log.md`, and
   Git path history; record a factual disposition before moving anything.
2. Add current metadata only where needed to make the audited disposition
   explicit, then archive completed/superseded records.
3. Delete only routine records meeting all retention conditions; preserve
   architecture, integration, or unresolved records even when completed.
4. Update root counts and factual log. Do not classify plans outside this batch.

## Validation

- Per-plan Outcome/log/Git evidence table retained in this target Outcome.
- Root metadata count matches `plan/root-audit.md`.
- No non-archive references remain to any deleted path.
- Markdown formatting for changed records.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
chore(plan): classify legacy records batch 1
```

## Outcome

Each record was classified against its final body and Git path history; the
following commits are the durable implementation or decision evidence.

| Plan                       | Evidence  | Disposition                   |
| -------------------------- | --------- | ----------------------------- |
| agent-routing boundary ADR | `72a301d` | archived, completed/none      |
| agent-routing expander     | `e7e7aa4` | archived, completed/none      |
| integrated checkpoint      | `21b85fd` | archived, completed/none      |
| authoring-fidelity closure | `f72e284` | archived, completed/none      |
| CDAC hierarchy layout      | `21b85fd` | archived, completed/none      |
| automatic-router deferral  | `9e3fc1b` | archived, completed/none      |
| text/label hit fixes       | `a9a90e6` | archived, completed/none      |
| Phase 8 execution          | `ca62c60` | retained, completed/candidate |
| Phase 9 workflow           | `21b85fd` | archived, completed/none      |
| wire editing               | `c035d7b` | retained, completed/candidate |
| hidden MOS terminals       | `ed6e878` | archived, completed/none      |
| interaction redesign       | `3c0eeec` | retained, completed/candidate |
| three-terminal MOS arrow   | `21b85fd` | archived, completed/none      |
| local-power CDAC           | `21b85fd` | archived, completed/none      |
| move stretches routes      | `9f103c2` | archived, completed/none      |
| flattened CDAC prototype   | `21b85fd` | archived, completed/none      |
| Razavi canon manifest      | `1a41c30` | retained, completed/candidate |
| Razavi RV-4 typography     | `dfc5763` | archived, completed/none      |
| Razavi RV-5 annotations    | `3a16045` | archived, completed/none      |
| Razavi RV-6A evidence      | `281e6cd` | archived, completed/none      |
| rule-guided layout record  | `21b85fd` | retained, completed/candidate |
| default schematic style    | `d003a8c` | archived, completed/none      |
| hierarchical ports         | `21b85fd` | retained, completed/candidate |
| routing-quality metrics    | `75442b0` | archived, completed/none      |
| transact protocol          | `ce717c9` | archived, completed/none      |

The six retained records explicitly request a human experience decision, so
they were not archived. No routine record in this batch met the deletion
criteria.
