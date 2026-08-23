---
status: active
experience: none
---

# Merge Unified Net Lifecycle to Main

## Goal

Integrate the latest `origin/main` into `codex/project-net-lifecycle`, preserve
both the accepted editor changes and the unified Base-Net/Marker/Logical-Net
foundation, pass the canonical local and remote gates, and merge the reviewed
branch to `main`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The worktree is clean. `origin/main` has 9 commits absent from this branch and
the branch has 12 commits absent from `origin/main`. This integration target
owns merge conflict resolutions across the existing branch diff, this plan,
and `plan/log.md`. It does not introduce new Net behavior beyond fixes required
to preserve the two sides' accepted contracts.

Shared dependencies: model schema, Edit Engine transaction/routing behavior,
editor interaction, generated Agent contracts, fixtures, and all canonical
delivery gates.

## Work

1. Merge `origin/main` without rewriting the published branch history.
2. Resolve conflicts by retaining the unified Net contracts and the latest
   mainline editor/routing behavior.
3. Run clean-install canonical validation, push the review branch, and wait for
   required GitHub checks.
4. Merge the reviewed branch to `main` and verify the resulting remote state.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- GitHub required checks on `codex/project-net-lifecycle`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: full fallback is required because the branch changes generated Agent contracts and compatibility fixtures.
- Affected gates: canonical `ci:check` subsumes static, unit, browser, build, protocol, generated-artifact, and smoke contracts.
- Final gates: required GitHub checks must be green before merge to `main`.
- Platform risks: merge conflicts may combine Linux-sensitive generated files, browser behavior, and mainline routing changes.

## Test Impact

- Decision: tests-updated
- Contracts: existing branch tests declare the unified Net lifecycle; mainline tests declare the nine incoming editor/routing changes. Conflict resolution must preserve both.
- Primary checks: canonical `pnpm ci:check` and remote required checks.

## Commit Intent

Commit as the merge commit produced by:

```text
git merge --no-ff origin/main
```

## Outcome

Pending.
