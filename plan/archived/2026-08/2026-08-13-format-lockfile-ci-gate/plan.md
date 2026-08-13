---
status: completed
experience: none
---

# Restore Lockfile Static CI Contract

## Goal

Repair PR #33's failing Static contracts check by formatting `pnpm-lock.yaml`
with the repository Prettier contract, without changing resolved dependencies.

## State and Ownership

Start state: clean `codex/local-validation-optimization` worktree at
`8455771`. GitHub Actions run `31669778351`, job `94351891244`, failed only
because `pnpm format:check` reported `pnpm-lock.yaml`. This target owns that
lockfile, its plan/log record, and delivery of the current PR. Product code,
dependency versions, and CI workflow definitions are read-only.

## Work

1. Format the lockfile using the repository Prettier version.
2. Confirm the static CI command passes and lock resolution remains frozen.
3. Push, wait for required GitHub checks, then merge the PR after green status.

## Validation

- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm install --frozen-lockfile`
- `git diff --check`
- Required GitHub Actions checks on PR #33

## Commit Intent

```text
chore(ci): format lockfile static contract
```

## Outcome

Formatted `pnpm-lock.yaml` with the repository Prettier configuration. This is
serialization-only: frozen installation succeeded without a resolution change.
The complete local static gate passed: formatting, pinned-reference validation,
and TypeScript typecheck.
