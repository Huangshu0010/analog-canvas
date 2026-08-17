---
status: completed
experience: none
---

# Refresh MCP Release Checksum

## Goal

Refresh the canonical Linux MCP tarball checksum after the integrated protocol
documentation changed bundled MCP resources, then verify and deliver the
combined branch through the required CI gate.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/merge-protocol-test-system...origin/agent/merge-protocol-test-system
```

The worktree is clean. This target owns only the release checksum, its plan,
and the factual delivery log. The protocol and test-system changes already
integrated by commit `9bc6855` are read-only.

- `config/agent-mcp-distribution.json`
- `plan/2026-08-17-refresh-mcp-release-checksum/plan.md`
- `plan/log.md`

Shared dependencies are the Linux GitHub Actions release job, MCP package
generation, the public bootstrap manifest, and the `release.sha256` integrity
contract.

## Work

1. Replace the stale Linux tarball checksum with the digest produced by the
   failed CI release job for this exact integration commit.
2. Run the canonical local mainline check from a fresh install as required.
3. Push the correction, wait for all required remote checks, then merge PR 105
   into `main` with a merge commit.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- GitHub Actions required checks for PR 105

## Test Impact

- Decision: no-test-change
- Reason: the change updates a generated-artifact integrity pin. Existing
  `pnpm ci:release` rebuilds, packages, hashes, and smoke-tests the artifact.

## Commit Intent

Commit as:

```text
chore(release): refresh MCP package checksum
```

## Outcome

Updated the Linux canonical checksum to
`7b52b116879ec75a8b0b514a947a7872008f0a7ad553540553eec80ddc1e15ba`, the
digest produced by the Linux GitHub Actions release job for the integrated
protocol resources. From a clean dependency state, `pnpm install
--frozen-lockfile` and `pnpm ci:check` passed: static contracts, 804 unit
tests, the production build and release smokes, and 143 browser tests.
