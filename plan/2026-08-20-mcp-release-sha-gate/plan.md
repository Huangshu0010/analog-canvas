---
status: active
experience: none
---

# Scope MCP SHA enforcement to explicit publishing

## Goal

Prevent ordinary CI from comparing a development MCP tarball to the SHA-256 of
the last published release. Preserve that comparison for the manually invoked
MCP publishing workflow.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .pnpm-store/
?? .worktrees/
```

`.pnpm-store/` and `.worktrees/` are user-owned/unrelated local state and will
not be modified. This target owns:

- `scripts/package-mcp.mjs`
- `scripts/lib/mcp-release-integrity.mjs`
- `scripts/lib/mcp-release-integrity.test.mjs`
- `package.json`
- `.github/workflows/mcp-release.yml`
- `plan/2026-08-20-mcp-release-sha-gate/plan.md`
- `plan/log.md`

Read-only shared contracts: `config/agent-mcp-distribution.json`, the public
MCP bootstrap manifest, and the immutable GitHub Release assets.

## Work

1. Extract the optional declared-release SHA check into a small tested helper.
2. Make normal MCP packaging emit the current artifact checksum without
   comparing it to the last published release.
3. Add an explicit release-package command and use it only in the manual
   Publish MCP workflow.

## Validation

- Focused integrity-helper Vitest contract.
- `pnpm mcp:package`
- Linux GitHub Publish MCP workflow validates the explicit release command.
- `pnpm ci:static`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- Canonical GitHub Actions checks before merge.

## Test Impact

- Decision: tests-updated
- Contracts: development packaging does not bind to a published artifact SHA;
  explicit release packaging rejects a mismatched declared SHA.
- Primary checks: integrity-helper Vitest contract and GitHub Release contracts.

## Commit Intent

Commit as:

```text
fix(release): scope MCP checksum verification to publishing
```

## Outcome

Implemented explicit release-only SHA verification. Ordinary MCP packaging now
emits its current checksum without comparing it to the checksum of the last
published artifact; the manual Publish MCP workflow is the sole caller of the
declared-checksum command.

Validation passed locally: focused helper contract (5 tests), normal MCP
package, static contracts, test-impact, and the full `pnpm ci:check` gate.
GitHub Actions validation remains pending before completion.
