# Execute Phase 6 Agent API

## Goal

Deliver Agent Circuit API v1 as a small transport-independent service with
exactly four operations (`capabilities`, `query`, `transact`, `render`), a
schema/OpenAPI surface, an opt-in authenticated loopback HTTP adapter, bounded
context, Edit Engine parity, and reviewed Agent guidance without MCP.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 1]
```

The worktree is clean. Phase 5 is committed locally as `346b308`; GitHub push
is pending because repeated TLS handshakes failed. No uncommitted user changes
overlap this target.

## Owned Files

- `docs/adr/0005-agent-api-without-mcp.md`
- `docs/specs/agent-api.md`
- `docs/specs/README.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-6-agent-api.md`
- `docs/agent/`
- `packages/agent-adapter/`
- workspace configuration required to register the package
- `fixtures/agent-api/`
- `plan/2026-08-07-execute-phase-6/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/`
- `packages/derived/`
- `packages/edit-engine/`
- `packages/render-svg/`
- `packages/symbols/`
- `apps/editor/`
- `lib/`, `netlists/`, and `.reference-src/`

## Shared Dependencies

- the complete typed Edit Engine union and dry-run/revision semantics
- deterministic visual diagnostics and formal SVG renderer
- Project → Documents persistence without raw Document replacement
- the user decision to expose a normal API and not implement MCP

## Frozen Decisions

- The core service is in-process and transport-independent.
- External process access uses one optional loopback-only JSON HTTP endpoint
  with a required bearer token; no MCP server or dependency is introduced.
- Requests never accept Project JSON, whole-Document replacement, JavaScript,
  filesystem paths, or raw SVG input.
- Render responses carry bounded base64-encoded image data plus media type and
  hash, not an executable or persistence payload.
- Query always requires an explicit scope and enforces object/text limits.
- The adapter constructs the `agent` actor and maps every allowed transaction
  to the shared Edit Engine; it cannot impersonate a human or bypass revision,
  locks, validation, or atomicity.
- Connectivity, geometry, presentation, render, and source-span permissions
  are enforced separately.

## Expected Work

1. Accept the no-MCP/optional-loopback ADR and normative API v1 specification.
2. Implement request/response schemas, JSON Schema/OpenAPI output, capabilities,
   bounded query descriptors, permission checks, and typed errors.
3. Implement dry-run/apply through `executeTransaction`, safe state commit,
   deterministic change history, and formal/diagnostic render artifacts.
4. Implement and security-test the authenticated loopback HTTP adapter.
5. Add GUI/Agent semantic parity tests plus at least three reproducible Agent
   workflows and layout/routing guidance.
6. Update roadmap completion evidence and the execution log.

## Validation

- schema and OpenAPI sample validation
- permission, budget, truncation, stale revision, dry-run, atomicity, and parity
  tests
- loopback/token/body-limit tests
- formal versus diagnostic overlay render checks
- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- Markdown link and fence checks
- no-MCP/package coupling inspection
- `git diff --check`
- `git status --short --branch`

## Experience Signal (for human review)

None at target start. No experience note will be extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 6 Agent API
```

## Outcome

- Accepted a four-operation, no-MCP Agent Circuit API v1 with checked JSON
  Schema/OpenAPI artifacts.
- Implemented bounded scopes, independent permissions, source-span opt-in,
  deterministic change history, and base64 formal/diagnostic renders.
- Proved Agent transaction parity with the shared Edit Engine, including dry
  run, commit, stale revision, locks, and atomicity.
- Added an opt-in token-protected loopback adapter plus reviewed usage,
  layout/routing guidance, and three reproducible workflows.
