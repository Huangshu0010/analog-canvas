---
status: completed
experience: none
---

# Refresh MCP Checksum for the Net and Diagnostics Release Candidate

## Goal

Update the Linux MCP tarball integrity lock after the included Net and Agent
API changes altered the packaged server artifact, restoring the required
Release contracts check without changing runtime behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/diagnostic-lifecycle...origin/codex/diagnostic-lifecycle
?? .worktrees/
```

`.worktrees/` is unrelated user/coordination state and will remain untouched.
The branch is otherwise clean. The failed PR #118 Linux Release contracts job
for the exact head commit emitted the new authoritative digest
`7026484dad9e2bafbb2a2ac9bb8aef142990731d0002c219b11e57acc5b92339`.

Owned paths:

- `config/agent-mcp-distribution.json`
- `plan/2026-08-18-refresh-mcp-checksum-net-diagnostics/plan.md`
- `plan/log.md`

Read-only/shared dependencies:

- `scripts/package-mcp.mjs`
- `apps/mcp-server/` and Agent API generated resources
- PR #118 Linux Release contracts artifact and integrity policy

## Work

1. Replace only the stale Linux SHA-256 lock with the CI-emitted digest.
2. Run local distribution/release verification; Windows intentionally does not
   compare the Linux tarball digest.
3. Push and require the new PR #118 Linux Release contracts check to verify
   the lock before merge.

## Validation

- `pnpm mcp:distribution:check`
- `pnpm build && pnpm release:verify:built`
- `git diff --check`
- `git status --short --branch`
- GitHub Actions required checks for PR #118

## Test Impact

- Decision: no-test-change
- Reason: this changes only the canonical Linux release-artifact integrity
  pin; existing local and remote release verification rebuilds, packages,
  hashes, and smoke-tests the artifact.

## Commit Intent

Commit as:

```text
fix(release): refresh MCP checksum
```

## Outcome

Updated the Linux integrity pin to
`7026484dad9e2bafbb2a2ac9bb8aef142990731d0002c219b11e57acc5b92339`, emitted
by the failed PR #118 Release contracts job for this exact release candidate.
`pnpm mcp:distribution:check`, workspace build, and
`pnpm release:verify:built` passed locally. The pushed correction requires a
fresh remote Linux Release contracts check before merge.
