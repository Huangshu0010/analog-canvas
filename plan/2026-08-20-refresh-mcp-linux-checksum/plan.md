---
status: completed
experience: none
---

# Refresh the Linux MCP Release Checksum

## Goal

Replace the stale canonical Linux MCP tarball SHA-256 reported by the requested
PR's Release contracts job, without weakening the platform-specific integrity
check.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The worktree is clean. This target owns:

- `config/agent-mcp-distribution.json`
- `plan/2026-08-20-refresh-mcp-linux-checksum/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

`scripts/package-mcp.mjs` is a read-only shared release contract. The failed
Linux GitHub Actions job reported the newly packaged tarball digest; Windows
development tarballs intentionally have different archive metadata.

## Work

1. Replace only the Linux SHA-256 pin with the digest reported by the failed
   Release contracts job.
2. Validate distribution metadata and the local release path, then push the
   correction and require a green replacement remote CI run before merging.

## Validation

- `pnpm mcp:distribution:check`
- `pnpm ci:release`
- remote Release contracts and all required PR checks
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target updates a Linux release-artifact integrity pin only.
- Existing protection: the packaged release path is executed directly locally
  and in remote CI.

## Commit Intent

Commit as:

```text
chore(release): refresh MCP Linux checksum
```

## Outcome

Replaced the stale Linux tarball SHA-256 with the digest reported by the
required CI job. Distribution metadata validation and the complete local
release verification passed; the replacement remote Release contracts check
remains required before merging.
