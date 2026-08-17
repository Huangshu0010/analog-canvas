---
status: completed
experience: none
---

# Refresh Project Protocol MCP Release Checksum

## Goal

Refresh the MCP tarball's Linux SHA-256 lock after the Project-protocol module
split changed the packaged server artifact, without changing runtime behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/device-protocol-compatibility-plan...origin/codex/device-protocol-compatibility-plan
?? .worktrees/
```

The only dirty path is the user-owned, untracked `.worktrees/` directory. It
does not overlap this target and will remain untouched.

- Owned: `config/agent-mcp-distribution.json`, this plan, `plan/root-audit.md`,
  and `plan/log.md`.
- Read-only: `scripts/package-mcp.mjs`, remote Release contracts log, and the
  packaged MCP source.
- Shared: the Linux MCP tarball integrity pin used by release verification.

## Work

1. Replace the stale SHA-256 lock with the digest emitted by Release contracts
   for the current PR merge candidate.
2. Run local release verification and await the remote Linux integrity check.

## Validation

- `pnpm mcp:distribution:check`
- `pnpm build && pnpm release:verify:built`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this is an integrity pin refresh for an already built release
  artifact; it makes no runtime behavior change.
- Existing protection: the local release verification and the remote Linux
  Release contracts job package and compare the artifact digest.

## Commit Intent

Commit as:

```text
fix(release): refresh MCP checksum
```

## Outcome

The integrity pin now uses the SHA-256 emitted by the current PR merge
candidate's Linux Release contracts job:
`83f59d02f32c9bf4e9e5bcda91f9e8c74f731bc7778787303f8649d24ad4944b`.
`pnpm mcp:distribution:check` and
`pnpm build && pnpm release:verify:built` passed locally. The commit awaits
remote Linux required-check verification.
