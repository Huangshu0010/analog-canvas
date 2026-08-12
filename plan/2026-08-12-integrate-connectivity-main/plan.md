---
status: active
experience: none
---

# Integrate connectivity work onto current main

## Goal

Merge `codex/construction-line-k-shortcut` into an integration branch rooted at
the latest `origin/main`, preserve both the new production analytics/deployment
work and the connectivity/routing work, and validate the combined candidate
before it is proposed for main.

## State and Ownership

Start state from `git status --short --branch` after creating the integration
branch from `origin/main`:

```text
## codex/integrate-connectivity-main...origin/main
```

The worktree is clean. Git's read-only merge preview reported one textual
conflict in `plan/log.md`; overlapping functional files auto-merged in the
preview. This target owns only integration metadata and conflict resolution.
Any functional-code conflict stops the target for human direction.

- `plan/2026-08-12-integrate-connectivity-main/plan.md`
- `plan/log.md`

Merge-owned/read-only integration surface: all paths changed by
`codex/construction-line-k-shortcut` and `origin/main`. Functional files may be
validated and reviewed but will not be manually conflict-resolved without
human approval.

## Work

1. Record this integration target, then merge the published connectivity branch
   with an explicit merge commit.
2. If the only conflict is `plan/log.md`, preserve both factual histories; stop
   if any functional path conflicts.
3. Audit the combined `App.tsx`, E2E, CSS, dependency, and deployment surfaces.
4. Run the frozen install and complete repository CI gate.
5. Close the target and push the integration branch only after validation.

## Validation

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm ci:check`
- merge-parent and combined-surface audit
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Create an explicit merge commit and a close-out documentation commit on:

```text
codex/integrate-connectivity-main
```

## Outcome

Pending merge and validation.
