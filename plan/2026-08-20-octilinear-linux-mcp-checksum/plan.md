---
status: completed
experience: none
---

# Refresh Linux MCP Checksum after Octilinear Release Build

## Goal

Replace the canonical Linux MCP tarball checksum with the value emitted by the
failed PR #130 Release contracts job, then require its replacement remote gate
to pass before merging the octilinear Route protocol.

## State and Ownership

The active branch is `codex/octilinear-route-protocol`, based on current
`origin/main`. The only pre-existing untracked paths are `.pnpm-store/` and
`.worktrees/`; they are local infrastructure and outside this target.

This target owns:

- `config/agent-mcp-distribution.json`
- this plan and its factual `plan/log.md` entry

Read-only dependencies are `scripts/package-mcp.mjs`, release packaging
scripts, Agent bootstrap consumers, and the required GitHub Actions release
job. The prior checksum plan is historical evidence only; it does not own this
new artifact digest.

## Work

1. Pin the SHA-256 reported by PR #130's Linux `package-mcp` run:
   `7058c46f70777e682515e7e01cc5d82208a91bf26edc59c1019ff09dc58cdd20`.
2. Validate the distribution schema and full local release path. Push the
   correction to the existing PR and require the replacement remote release
   job plus all other required checks before merge.

## Validation

- `pnpm mcp:distribution:check`
- `pnpm release:verify`
- remote required PR #130 checks
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this updates only the platform-specific checksum for an already
  packaged Linux MCP tarball.
- Existing protection: local distribution/release verification and the same
  Linux GitHub Actions release-contract job.

## Commit Intent

```text
chore(release): refresh MCP Linux checksum
```

## Outcome

Replaced the stale Linux checksum with the exact digest emitted by PR #130's
Linux Release contracts job. `pnpm mcp:distribution:check` and complete local
`pnpm release:verify` passed. The replacement remote required checks remain
the final merge gate.
