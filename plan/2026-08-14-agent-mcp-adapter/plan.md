---
status: completed
experience: none
---

# Agent-side MCP adapter over the four-operation API (M0-M3)

## Goal

Deliver the first implementation slice of the accepted Agent-side MCP design
(new ADR 0020): a local stdio MCP server that lets Codex/Claude/Cursor drive
the existing four-operation Agent API without handling raw OpenAPI payloads,
tokens, revisions, or typed edit unions. This target covers design milestones
M0-M3:

- M0: freeze contract/doc boundary — ADR 0020, `docs/agent/resource-manifest.json`,
  manifest-driven resource generator + CI check, docs entry adjustment.
- M1: `packages/agent-client` — `AgentHttpClient`, connection state machine,
  `AgentSessionClient` (claim/resume, token/session/documentIds, capabilities
  and revision caches, requestId idempotent retry, structured error
  normalization), user-level credential store (token never reaches the model).
- M2: `SnapshotCache` + `apps/mcp-server` stdio MCP with `connect`,
  `connection_status`, `get_context`, `inspect`, `search`, `verify`, `render`
  and MCP Resources projected from the same sources as the HTTP Kit.
- M3: `AuthoringHelper` compiling `apply_actions` (place/connect/disconnect/
  move/rotate/mirror/rename/set-property/add-label/edit-text/annotate/arrange/
  delete/add-power-rail) into existing typed edits / `wireIntent`, with
  dry-run-then-commit and compact diff results; `advanced_transact` escape
  hatch gated on reading the advanced-edits resource.

M4 (persistent connector credential, server-side pairing lifecycle, web revoke
UI, file import/export) and M5 (full delivery gate with a live golden path) are
deliberately excluded: they change worker/editor shared contracts and require a
deployment. They remain follow-up targets.

## State and Ownership

```text
## main...origin/main
(clean worktree at branch creation)
```

Branch `codex/agent-mcp-adapter` cut from `main` at `8c49121`.

Owned (new files unless noted):

- `docs/adr/0020-agent-side-mcp-adapter.md`
- `docs/agent/resource-manifest.json`
- `docs/agent/README.md` (entry-point section only)
- `scripts/generate-mcp-resources.mjs`
- `packages/agent-client/**`
- `apps/mcp-server/**`
- `packages/agent-adapter/src/agent-kit.ts` (re-export the generated catalog so
  the MCP helper consumes the single catalog source)
- Shared contracts claimed deliberately: root `package.json` (add
  `mcp:resources[:check]` script; wire check into `ci:static`),
  `tsconfig.check.json` (paths for the two new packages),
  `pnpm-lock.yaml` (new importers), `plan/log.md` (close-out entry).

Read-only:

- `worker/**`, `apps/editor/**`, `packages/edit-engine/**`,
  `packages/model/**` — the four-operation API, session relay, and edit
  contract stay byte-identical.
- `packages/agent-adapter/src/**` except `agent-kit.ts` re-export.

## Work

1. ADR 0020 + resource manifest + generator script + docs entry adjustment.
2. `packages/agent-client`: http-client, connection-state, credential-store,
   snapshot-cache, session-client, authoring-helper.
3. `apps/mcp-server`: hand-rolled minimal MCP stdio JSON-RPC protocol layer
   (initialize/tools/resources/ping; zero new runtime dependencies to avoid a
   zod v4 peer conflict with the official SDK — recorded in the ADR), tools,
   resources, results, CLI entry.
4. Unit tests (agent-client) and contract tests (mcp-server tool schema to API
   mapping; protocol handshake) co-located per repo convention.
5. Register packages: tsconfig paths, workspace importers, CI static check.

## Validation

- `git diff --check`, `git status --short --branch`
- `pnpm install` (register importers), then:
- `pnpm typecheck`
- `pnpm test:local packages/agent-client packages/agent-adapter apps/mcp-server`
- `pnpm agent-kit:catalog:check && node scripts/generate-mcp-resources.mjs --check`
- `pnpm format:check` on touched globs (run `pnpm format` if needed)
- Limitation: the M5 live golden path (real Codex host against a deployed
  worker) cannot run locally; covered instead by protocol-level tests plus a
  compile→dry-run→commit integration test against an in-process fake relay.

## Commit Intent

```text
feat(agent): add Agent-side stdio MCP adapter (M0-M3)
```

## Outcome

Delivered M0-M3 of the Agent-side MCP adapter on branch
`codex/agent-mcp-adapter`:

- ADR 0020 accepted; `docs/agent/resource-manifest.json` declares the single
  knowledge-source projection; `scripts/generate-mcp-resources.mjs` +
  `pnpm mcp:resources[:check]` generate/verify the MCP resource payload;
  `docs/agent/README.md` entry order is now MCP → Kit/HTTP → OpenAPI.
- `packages/agent-client` (Node-only Helper): HTTP client, connection state
  machine, credential store, snapshot cache with changed-object diffing,
  `AgentSessionClient` (claim/resume, capabilities/revision caches,
  exact-payload network retry, editor-offline/revoked normalization,
  dry-run-then-commit `applyActions` with `STATE_CHANGED` reporting), and the
  action compiler (14 high-level actions → existing typed edits/`wireIntent`,
  validated against `AgentSchematicEditSchema`).
- `apps/mcp-server`: hand-rolled stdio JSON-RPC MCP subset (initialize/ping/
  tools/resources, ordered responses, unknown methods fail closed), 9 compact
  tools, 11 resources, advanced-contract read gate, SVG render as image block.
- Registration: workspace importers, `tsconfig.check.json` paths, catalog
  re-export from `@icm/agent-adapter/kit`.

The four-operation API, worker, editor, and Edit Engine are untouched (only
byte-level additions plus the agent-kit catalog re-export).

Validation: 71 new unit/contract tests green; full `pnpm test:local` suite
113 files / 638 tests green; `ci:static` components (format, markdown links,
references, agent-kit catalog, typecheck) green individually; composite builds
of both new packages; generated-resource `--check` up to date; live smoke of
the built stdio server (initialize negotiation, 9 tools, 11 resources);
`git diff --check` clean.

Limitations recorded: M4 (persistent connector credential, web revoke UI,
file tools) and M5 (deployed golden-path delivery gate) remain follow-up
targets; `render` returns `image/svg+xml` which some hosts rasterize poorly;
the local environment could not run `pnpm ci:check` end to end because plain
`pnpm` is not on PATH (corepack works), so the remote required checks are the
delivery authority for this branch.
