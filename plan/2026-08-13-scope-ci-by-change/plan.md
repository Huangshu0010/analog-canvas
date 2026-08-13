---
status: completed
experience: none
---

# Scope CI by Changed Surface

## Goal

Keep required checks visible on every pull request while avoiding release and
browser workloads when a change affects only documentation or planning files.

## State and Ownership

Start state:

```text
## codex/ci-contract-cleanup
```

The worktree is clean and the branch starts from merged `origin/main`. This
target owns `.github/workflows/ci.yml`, focused CI policy validation, this plan,
and its log entry. Product code and test behavior are read-only.

## Work

1. Add a deterministic changed-surface classification job.
2. Preserve all required check names, but make heavy jobs return successful
   no-op results for documentation-only changes.
3. Keep the existing full gate for product, test, workflow, configuration, and
   dependency changes.

## Validation

- Parse the workflow as YAML.
- Inspect the event/path logic for pull requests and pushes.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
ci: skip heavy gates for documentation-only changes
```

## Outcome

Added a `Change scope` job that classifies pull-request paths against the
repository's existing documentation boundary. The five established required
check names still run, but each performs a fast successful no-op for
documentation-only changes. Product, test, dependency, configuration, and
workflow changes retain the full jobs; non-document pushes to `main` also keep
the full gate.

Prettier parsed and accepted the workflow formatting, manual event/path review
covered pull-request and push behavior, and `git diff --check` passed.
