---
status: completed
experience: none
---

# Expand Routine Plan Record Pruning

## Goal

Further reduce historical plan-body bloat by deleting archived, completed
routine records whose durable evidence is already retained in Git and
`plan/log.md`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/plan-lifecycle-hygiene...origin/codex/plan-lifecycle-hygiene
```

The worktree is clean. This target owns the selected routine plan bodies under
`plan/archived/2026-08/`, the retention wording and archive index, this plan,
and its factual log entry. It does not alter product code, tests, fixtures, or
open plans.

- Owned: `plan/archived/2026-08/`, `plan/README.md`,
  `plan/archived/README.md`, `plan/log.md`, this target directory
- Read-only: `AGENTS.md`, repository Git history, current root plans, product
  source, tests, specifications, ADRs, and experience notes
- Shared: `plan/log.md` and the archive retention policy

## Work

1. Classify the remaining archived plans using their outcome, corresponding
   factual log entry, and Git history; select only independently
   reconstructible visual/UI/shortcut/calibration records.
2. Delete the selected plan bodies and replace the per-plan archive table with
   a concise retention record, leaving Git and `plan/log.md` as the evidence
   surface.
3. Clarify that routine retention is based on durable evidence and decision
   value, not an arbitrary plan length.
4. Preserve architecture, schemas, migrations, release/CI/deployment,
   cross-branch integration, ongoing coordination, unresolved states, and
   experience-bearing records.

## Validation

- Verify every deletion has Git history and an explicit factual `plan/log.md`
  entry before removal.
- Confirm retained protected categories remain present.
- `git diff --check`
- `git status --short --branch`

No product behavior changes, so code or full-suite validation is not applicable.

## Commit Intent

Commit as:

```text
docs(plan): expand routine record pruning
```

## Outcome

Deleted 20 archived routine plan bodies after individually confirming their
completed outcome, matching factual log record, and Git history. The records
cover UI and shortcut refinements, standalone symbols, calibration, example
fixtures, and a narrow typecheck repair. Retained records include architecture,
migration, recovery, integration, CI/deployment, shared geometry contracts,
and experience context.

The archive index no longer duplicates per-plan commit tables. `plan/README.md`
now makes clear that durable evidence and decision value—not plan length or
age—govern pruning. Protected-record presence and the 20-file deletion count
were verified. `git diff --check` passed and final worktree status contains
only this target's planned documentation deletions and updates. No product
behavior changed.
