---
status: active
experience: none
---

# Repair PR 117 CI contracts

## Goal

Repair the release-integrity pin and connected-wire drag-preview regressions
reported by PR #117, then re-run the local and GitHub delivery gates.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers...origin/codex/app-transaction-module-layers
?? .worktrees/
```

`.worktrees/` is pre-existing, untracked workspace infrastructure and does not
overlap this target. This target owns the CI pin, selection-interaction code,
their regression coverage if needed, and its plan/log records.

- `config/agent-mcp-distribution.json`
- `apps/editor/src/features/selection/use-selection-interaction.ts`
- `apps/editor/e2e/manual-editor.spec.ts` (only if a test adjustment is required)
- `plan/2026-08-17-fix-pr117-ci/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Shared dependencies: the MCP packaging checksum contract and editor move/copy
interaction protocol. Read-only investigation includes the current `origin/main`
implementation, package script, CI logs, and drag-visual helpers.

## Work

1. Compare the merged Hook implementation against the current mainline
   connected-wire move behavior, and restore the missing route preview within
   the selection interaction boundary.
2. Update the MCP distribution integrity pin to the CI-produced canonical hash.
3. Run focused browser and release checks, impact analysis, static diff checks,
   then push the repair and wait for all GitHub checks.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "previews a connected Wire|moves internal wiring with a selected group"`
- `pnpm release:verify`
- `pnpm test:impact -- --base origin/main`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- GitHub PR #117 required checks

## Test Impact

- Decision: no-test-change
- Reason: this restores the already-specified drag-preview behavior and refreshes
  its generated release-artifact integrity pin; neither requires a new contract.
- Existing protection: `apps/editor/e2e/manual-editor.spec.ts` directly covers
  the two reported move/copy previews, and the release verification packages
  and verifies the integrity pin.

## Commit Intent

Commit as:

```text
fix(editor): restore connected wire drag previews
```

## Local validation

Restored the mainline route projection during instance-led selection drags
inside the selection Hook, so attached and internal routes update live without
reintroducing that interaction owner to `App.tsx`. Refreshed the Linux MCP
artifact SHA-256 from the failing CI job. The two targeted Playwright tests,
`pnpm release:verify`, `pnpm test:impact -- --base origin/main`,
`pnpm install --frozen-lockfile`, and the full `pnpm ci:check` passed; the
Playwright final record reports `passed` with no failed tests. `git diff --check`
passed. Remote CI remains to be re-run from the repair commit; this target
stays active until its required checks pass.
