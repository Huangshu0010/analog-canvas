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
untouched. This target owns its plan/log/audit records, Git refs, and the
MCP release checksum required to promote the branch. Source and tests are
read-only dependencies; `origin/main` is a fast-forward ancestor of the branch.

## Work

1. Run the clean-dependency mainline CI gate against the current branch.
2. Repair the MCP tarball checksum rejected by the Linux release-contract job.
3. Fast-forward local `main` to the verified hierarchy branch and push
   `origin/main` through the protected-branch PR.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `pnpm ci:release` where platform-equivalent validation is available
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

The first protected-branch CI run found an MCP tarball checksum mismatch in the
Linux release-contract job. The branch remains a fast-forward candidate, but
promotion is pending a corrected checksum and green remote required checks.
