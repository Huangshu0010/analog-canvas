---
status: active
experience: none
---

# MCP Bootstrap Distribution

## Goal

Make the packaged Analog Canvas MCP usable by a first-time external Agent from
the editor's existing **Copy to Agent** handoff: publish a versioned download,
serve one compact bootstrap manifest, teach the copied instruction to detect
MCP and fall back to the Agent Kit, and document host setup without expanding
the circuit API.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. Work starts from `origin/main` commit `7b70580` on
`agent/mcp-bootstrap-distribution`.

- `config/agent-mcp-distribution.json`
- `packages/agent-adapter/src/` distribution manifest contract
- `worker/agent-session.ts` and focused router tests
- `apps/editor/src/agent/connect-agent-panel.*`
- `scripts/package-mcp.mjs`, `scripts/package-release.mjs`, and focused
  distribution checks
- `.github/workflows/` MCP release publishing
- `docs/agent/` installation and bootstrap documentation
- `package.json`, `plan/2026-08-14-mcp-bootstrap-distribution/plan.md`, and
  `plan/log.md`

Shared dependencies are the existing four-capability HTTP API, Agent Kit,
compiled MCP Resources, and browser session lifecycle. They remain unchanged;
this target owns only discovery and distribution around them.

## Work

1. Establish one versioned MCP distribution declaration consumed by the
   package builder and public bootstrap response.
2. Serve a small public MCP bootstrap manifest with version, runtime,
   version-pinned launch commands, documentation, download, and Kit fallback.
3. Upgrade **Copy to Agent** to a compact detect/connect/bootstrap/fallback
   instruction and expose unobtrusive manual setup details.
4. Add a tag-driven GitHub Release workflow and optional npm publication from
   the exact same package artifact.
5. Validate package startup, manifest consistency, worker routing, copied UI
   text, and the existing MCP golden path.

## Validation

- `pnpm test:local apps/editor/src/agent/connect-agent-panel.test.tsx worker/agent-session.test.ts`
- focused distribution contract check and packaged stdio startup
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- required GitHub Actions checks before merge/release

The broad local and remote gates are justified because this target crosses the
browser UI, Worker public surface, generated release package, and delivery
workflow.

## Commit Intent

Commit as:

```text
feat(agent): publish self-bootstrapping MCP distribution
```

## Outcome

Pending.
