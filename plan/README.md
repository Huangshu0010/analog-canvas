# Plan Directory

The `plan/` directory stores implementation intent and factual maintenance
history so work stays bounded, owned, and verifiable.

## Target Plans

Create a plan before editing tracked files at:

```text
plan/<date-goal-slug>/plan.md
```

Start from `target-plan.template.md`. Each plan names the goal, dirty-state
decision, owned and read-only paths, shared dependencies, expected work,
validation sized to risk, and commit intent.

## Dirty Worktree Handling

A dirty worktree is an ownership question, not an automatic blocker. Proceed
only when dirty files are unrelated, do not overlap owned paths, and do not
alter a shared dependency. Record that decision in the plan. Stop and
coordinate when ownership or overlap is unclear.

## Maintenance Log

`log.md` records accepted project maintenance history. Each entry states the
date, target, changed areas, validation, and commit status. Keep it factual.

## Experience Extraction

Experience extraction is a human decision, not automatic target close-out. A
human may ask an Agent to draft an evidence-backed candidate in
`docs/experience/`; the human then accepts, edits, or rejects it. Raw status,
diffs, and validation transcripts belong in plans, logs, or Git history.

## Relationship to Git

Plans explain intent, logs explain outcomes, and Git records actual repository
state. A complete target normally ends with proportional validation, a log
update, intentional staging, a commit, and a push according to branch policy.
