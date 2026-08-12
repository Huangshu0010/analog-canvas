# Plan Directory

The `plan/` directory stores implementation intent and factual maintenance
history so work stays bounded, owned, and verifiable.

## Target Plans

Create a plan before editing tracked files at:

```text
plan/<date-goal-slug>/plan.md
```

Start from `target-plan.template.md`. Keep routine targets compact: state the
goal, dirty-state and ownership decision, work, validation, and commit intent.
Add explicit read-only paths, dependency analysis, test rationale, or
coordination detail only when the target's risk requires them.

Each plan begins with the current-state authority:

```yaml
---
status: active
experience: none
---
```

Allowed `status` values are `active`, `blocked`, `completed`, and
`superseded`. Allowed `experience` values are `none`, `candidate`, `extracted`,
`rejected`, and `deferred`. Do not create blank experience sections. Git, not
plan metadata, remains the authority for whether and where work was committed.

A target follows one ownership and validation boundary. Related symptoms that
share files, contracts, and checks normally belong in one target; unrelated
changes remain separate even when they are individually small.

## Dirty Worktree Handling

A dirty worktree is an ownership question, not an automatic blocker. Proceed
only when dirty files are unrelated, do not overlap owned paths, and do not
alter a shared dependency. Record that decision in the plan. Stop and
coordinate when ownership or overlap is unclear.

## Maintenance Log

`log.md` is the concise cross-target factual index. Each entry states the date,
target, changed areas, validation, and commit status; it does not repeat plan
intent, detailed transcripts, or reusable lessons.

## Archived Plans

Tracked plans with `status: completed` may move to
[`archived/`](archived/README.md) when their work is committed, validation and
outcome are recorded, no decision or coordination remains open, and
`experience` is resolved. Archive directories are grouped by completion month.
Moving a plan does not authorize rewriting its historical content.

Failed, blocked, unresolved, proposed-only, superseded-before-implementation,
pending, and active plans remain visible in the plan root.

[`root-audit.md`](root-audit.md) is the concise current queue for root plans
that are not yet eligible for archival. Update it when a plan's state changes;
do not treat an old directory's date as evidence that it is complete.

## Experience Extraction

Experience extraction is a human decision, not automatic target close-out. A
human may ask an Agent to draft an evidence-backed candidate in
`docs/experience/`; the human then accepts, edits, or rejects it. Raw status,
diffs, and validation transcripts belong in plans, logs, or Git history.

When a lesson is accepted, set the source plan to `experience: extracted` and
cite the experience note from the archive index or plan outcome. When it is not
worth extracting, use `rejected`; use `deferred` only for an explicit human
decision to postpone extraction.

## Relationship to Git

Plans own intent, boundaries, state, and concise outcomes; logs provide the
cross-target index; Git records exact repository state; experience notes own
transferable judgments. A complete target normally ends with proportional
validation, a plan outcome/state update, a concise log entry, intentional
staging, a commit, and a push according to branch policy.
