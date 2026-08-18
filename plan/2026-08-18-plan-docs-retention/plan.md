---
status: completed
experience: none
---

# Retain current planning evidence while reducing repository noise

## Goal

Reduce the active planning and documentation surface without changing product
behavior: remove independently reconstructible routine plan records, archive
completed non-routine plans and completed roadmaps, reconcile stale completion
markers, and compact pre-2026-08-13 factual-log entries to their essential
delivery evidence.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-hierarchy-v12...origin/codex/schematic-hierarchy-v12
?? .worktrees/
?? plan/2026-08-18-schematic-hierarchy-v12/
```

This target starts from that branch head on `codex/plan-docs-retention`. The
untracked `.worktrees/` directory and the hierarchy-v12 plan are owned by
another active target and remain untouched. The owned documentation-only set is:

- `plan/README.md`, `plan/root-audit.md`, `plan/log.md`, and this target plan;
- completed plan directories selected by the retention audit, including their
  moves to `plan/archived/2026-08/` or deletion when independently
  reconstructible;
- completed current-roadmap records and their archive/index references under
  `docs/roadmap/` and `docs/archive/roadmap/`.

Read-only: product code, tests, generated artifacts, current hierarchy-v12
work, accepted ADRs/specifications, the 17 `experience: candidate` plans, and
the 71 legacy plans without metadata.

Shared dependencies: `AGENTS.md` retention rules, Git commit/PR history, and
the current documentation authority map. Do not archive a plan that remains
active, unresolved, or under human experience review.

## Work

1. Reconcile completed markers whose delivery commits are already on
   `origin/main`; retain the uncommitted hierarchy-v12 plan as active.
2. Remove the audited routine UI/delivery records whose plan, log, and Git
   evidence fully reconstruct their history; archive completed non-routine
   records with resolved experience.
3. Compact factual-log entries dated through 2026-08-12 to date, target,
   changed-area, validation, and commit evidence; keep later entries intact.
4. Move completed Net-contract and connectivity-recovery roadmaps to the
   documentation archive, refresh the current roadmap boundary, and rebuild
   `root-audit.md` from the resulting retained queue.

## Validation

- Markdown relative-link audit for `README.md`, `docs/`, and `plan/`.
- Metadata inventory: no root completed/none plan remains outside the audited
  retention set; active/candidate/missing plans remain visible.
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Evidence: this target changes only plan/document retention and historical
  indexing; it neither changes product behavior nor any executable contract.
- Primary checks: metadata inventory and Markdown-link audit; no unit or E2E
  test change is warranted.

## Commit Intent

Commit as:

```text
docs: compact planning and roadmap retention
```

## Outcome

Reconciled eleven stale active markers whose delivery commits are already on
`origin/main`; deleted eighteen independently reconstructible UI/delivery
plans; and moved 119 completed, resolved non-routine plans into the August
archive. The legacy metadata queue and experience candidates remain visible.

Compacted 338 factual-log entries dated through 2026-08-12 from 8,372 lines to
3,106 total log lines while retaining changed-area, validation, and commit
status fields. Completed Net-contract and connectivity-recovery roadmaps now
live in the documentation archive; current roadmap and ADR links point to the
new locations. The current-document link audit and metadata audit passed, as
did `git diff --check`.
