---
status: active
experience: none
---

# Deployable Agent MCP connection and file workflow (M4-M5)

## Goal

Complete M4/M5 on `codex/agent-mcp-adapter`: make the local MCP adapter
reconnect across process restarts with a server-issued revocable connector
credential, expose the already-authoritative Agent file workflow through
compact MCP tools, package a host-installable MCP entry point, and prove one
deployable browser-to-MCP golden path without introducing a fifth Circuit
operation or a second mutation engine.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-mcp-adapter...origin/codex/agent-mcp-adapter
```

The worktree is clean. This target owns the connected delivery boundary:

- `packages/agent-adapter/**` for connector/file transport contracts only
- `worker/**` for server-issued connector lifecycle and forwarding only
- `apps/editor/src/agent/**` plus the narrow App/UI integration needed for
  connector status, revoke, and file approval
- `packages/agent-client/**` and `apps/mcp-server/**`
- release/package scripts, MCP/Agent docs, generated API/resource artifacts,
  focused fixtures/tests, this plan, and `plan/log.md`

The four Circuit operations, Project model, Edit Engine, routing engine, and
renderer remain read-only shared authorities. Existing browser file staging
and approval semantics must be reused rather than reimplemented. No simulation,
PVT, waveform, or netlist-export scope is added.

## Work

1. Characterize the already-merged reconnect and Agent file contracts, then
   freeze the smallest M4 additions: opaque connector credential issuance,
   resume, rotation/revoke, and no bearer exposure to MCP tool results.
2. Implement persistent Helper storage for the connector credential (not the
   short-lived bearer), automatic resume/refresh, and clear terminal recovery
   states.
3. Wrap existing file list/read/export/stage-import/approval status operations
   as compact MCP tools, preserving browser approval for Project replacement.
4. Add the minimum editor connection UI needed to create/rotate/revoke a
   connector and accurately distinguish panel close, editor offline, paused,
   and revoked states.
5. Package the stdio MCP server with a stable executable/configuration path and
   deployment documentation; add a deterministic end-to-end golden path from
   connector resume through inspect/edit/verify/render and file operations.
6. Run focused tests, branch verification, canonical delivery gates, and
   remote PR checks. Keep PR #49 open after push unless the user later asks to
   merge.

## Validation

- focused Agent adapter/Worker/editor/Helper/MCP unit tests
- focused browser session/file-approval tests
- MCP protocol, packaged executable, and golden-path smoke tests
- generated Agent API/resources/package checks
- `pnpm verify:branch`
- clean `pnpm install --frozen-lockfile` followed by `pnpm ci:check`
- `git diff --check` and `git status --short --branch`
- all required checks on PR #49

## Commit Intent

Use one integrated M4/M5 implementation commit because connector refresh,
file tools, packaged smoke, and generated contracts share the Helper/relay
boundary; use a separate factual closeout commit after remote checks. Push
only to `codex/agent-mcp-adapter` and do not merge in this target.

## Progress

- M4 connector issue/resume/revoke, bearer refresh, private Helper storage,
  same-browser editor recovery, and MCP-first hand-off are implemented.
- M5 Project/visual export, Project/structural-SPICE candidate staging,
  self-contained MCP packaging, release inclusion, and the two-process golden
  path are implemented.
- Focused contracts passed (187 tests), `pnpm verify:branch` passed (648
  tests), Cloudflare Worker deploy dry-run passed, and the clean-install
  `pnpm ci:check` gate passed (648 unit tests and 103 browser tests).
- Remote PR checks remain pending; the target stays active until they pass.

## Outcome

Pending.
