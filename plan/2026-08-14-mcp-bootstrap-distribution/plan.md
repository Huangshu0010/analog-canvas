---
status: completed
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

PR #50 merged the self-bootstrapping MCP distribution into `main`. The
production Worker now serves the versioned manifest used by **Copy to Agent**;
the same declaration drives package/release metadata and host setup. GitHub
Release `mcp-v0.1.0` publishes the 90.5 kB tarball, release metadata, and
checksums. Its public tarball SHA-256 is
`0383d9d26d4665339a89e80a9d8ecff91edcecb3022b268a038503260643dfda`.

Focused tests, typecheck, frozen install, local `pnpm ci:check` (649 unit and
integration tests plus 103 browser tests), all six PR checks, production
Cloudflare deployment, canonical Linux packaging, public download/hash
verification, and an `npx` MCP initialize against the Release URL passed.
The repository has no npm credential, so npm publication was truthfully
skipped and the manifest selects the fully working GitHub Release path.
