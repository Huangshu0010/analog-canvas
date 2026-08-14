---
status: active
experience: none
---

# Integrate Coordinate Domains with Flightline Guidance

## Goal

Rebase the imported-SPICE flightline-guidance change onto current `main`,
preserving the coordinate-domain/grid-normalization contract while retaining
the imported-document guidance policy and repaired MCP release checksum.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/import-flightline-guidance...origin/codex/import-flightline-guidance
```

The worktree is clean. This target owns the conflict resolution and its
delivery record:

- `apps/editor/src/app/App.tsx`
- `packages/model/src/schema.ts`
- `packages/spice/src/importer.ts`
- `packages/edit-engine/src/transaction.ts`
- focused tests and `plan/`
- `config/agent-mcp-distribution.json`

Shared dependencies: the coordinate-domain contract on current `main` and the
MCP release artifact checksum. Their accepted behavior is preserved rather
than rewritten.

## Work

1. Rebase onto `origin/main` and resolve `App.tsx` by retaining both coordinate
   normalization and the flightline display policy.
2. Run focused flightline tests, static checks, and the required delivery gate;
   record unrelated pre-existing failures if they recur.
3. Update the factual log, push the rebased branch, wait for required remote
   checks, and merge only when they pass.

## Validation

- `pnpm test:local packages/edit-engine/src/transaction.test.ts packages/spice/src/compiler.test.ts`
- isolated browser flightline tests
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit any conflict-resolution metadata as:

```text
chore(integration): rebase flightline guidance on coordinate domains
```

## Outcome

Pending.
