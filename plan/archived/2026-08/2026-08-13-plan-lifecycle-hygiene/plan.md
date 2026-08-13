---
status: completed
experience: none
---

# Reduce the active planning surface

## Goal

Restore `plan/` as a concise operational surface by archiving only target plans
whose current metadata proves their work is complete and their experience state
is resolved. Establish a small, explicit queue for every plan that remains in
the root instead of treating old files as active by default.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/plan-lifecycle-hygiene
```

The worktree is clean. This target owns the eligible completed plan moves, the
archive index, the root plan navigation, and an audit of the root plans that
remain. It does not rewrite historical plan bodies or change product code,
tests, contracts, active plans, candidate-experience plans, or plans with
missing state metadata.

- `plan/2026-08-13-plan-lifecycle-hygiene/plan.md`
- eligible `plan/<date-goal>/plan.md` directories with `status: completed`
  and `experience: none`
- `plan/archived/README.md`
- `plan/README.md`
- `plan/root-audit.md`
- `plan/log.md` only for this target's factual entry

Read-only and retained at the root:

- plans with `status: active`, `blocked`, `superseded`, or missing state
- completed plans with `experience: candidate`
- product source, generated artifacts, specifications, and ADRs

## Work

1. Enumerate tracked root plans using their machine-readable metadata and move
   only the 136 completed, `experience: none` target directories to
   `plan/archived/2026-08/` without changing their contents.
2. Record the archival batch in the archive index and add a concise root audit
   that lists retained categories and their required disposition.
3. Keep `plan/log.md` append-only in this target; defer its historical rotation
   to a separate target because it changes the repository-wide factual index
   and its external references.

## Validation

- every archived current-format plan has `status: completed` and
  `experience: none`
- no completed, candidate-experience plan is moved
- no active, superseded, proposed, or metadata-missing root plan is moved
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
docs(plan): archive resolved completed targets
```

## Outcome

Moved 136 completed current-format target directories into
`plan/archived/2026-08/` without modifying their historical bodies. Every moved
plan had `status: completed`, `experience: none`, a non-empty Outcome section,
and recorded Git history. The root now has a short audit of four active plans,
five human-owned experience decisions, two explicit state corrections, this
commit-gated completed plan, and 121 legacy plans requiring a separate metadata
sweep. Historical log rotation was intentionally deferred because it changes
the shared factual index and its external references.

Validation: metadata selection audit, retained-plan audit, and
`git diff --check` passed.
