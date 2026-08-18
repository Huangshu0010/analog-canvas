---
status: active
experience: none
---

# Merge hierarchy branch to main

## Goal

Promote the verified hierarchy authoring and domain-orchestration branch to
`origin/main` through a fast-forward merge after the mainline delivery gate.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-authoring-visual-plan...origin/codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned workspace infrastructure and remains
untouched. This target owns only its plan/log/audit records and Git refs for
the explicit branch-to-main integration. Source, generated artifacts, and
tests are read-only; `origin/main` is a fast-forward ancestor of the branch.

## Work

1. Run the clean-dependency mainline CI gate against the current branch.
2. Fast-forward local `main` to the verified hierarchy branch and push
   `origin/main`.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- confirm `origin/main` points to the promoted commit after push

## Test Impact

- Decision: no-test-change
- Reason: this target changes no product source or test contract; it promotes
  the already validated hierarchy branch, with the required full CI gate as
  evidence.

## Commit Intent

```text
chore(plan): record hierarchy mainline merge
```

## Outcome

Pending.
