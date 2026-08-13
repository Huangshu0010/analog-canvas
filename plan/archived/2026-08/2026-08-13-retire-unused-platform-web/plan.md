---
status: completed
experience: none
---

# Retire Unused Platform-Web Package

## Goal

Remove the unreferenced `@icm/platform-web` package without changing the
editor's active recovery or file workflow.

## State and Ownership

Start state: clean `codex/local-validation-optimization` worktree. This target
owns `packages/platform-web/`, workspace lock metadata, this plan, and its
factual log entry. The editor's recovery implementation, file commands,
product tests, and all other packages are read-only.

Read-only evidence established before editing: no source, package manifest, or
script imports `@icm/platform-web`; every exported implementation is only
referenced by its own tests. The editor instead uses its own active
`apps/editor/src/document/project-recovery.ts` workflow.

## Work

1. Remove the isolated package and its self-tests.
2. Regenerate only workspace metadata required by the removed package.
3. Confirm no imports or configuration references remain.

## Validation

- `pnpm install --lockfile-only` if the workspace lock changes.
- Focused editor recovery tests.
- `pnpm typecheck`, `git diff --check`, and status review.

## Commit Intent

```text
chore(platform): retire unused browser platform package
```

## Outcome

Removed the seven-file, isolated `@icm/platform-web` package and its lockfile
importer. The live editor continues to use
`apps/editor/src/document/project-recovery.ts`; no caller imported the retired
IndexedDB recovery store or File System Access wrappers.

Validation passed: lockfile-only install, no-reference search, four focused
editor recovery tests, workspace typecheck, and `git diff --check`.
