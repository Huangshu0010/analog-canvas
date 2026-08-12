---
status: completed
experience: none
---

# WP-WA6 — Agent Client Usage Contract

## Goal

Publish the public contract an ordinary external Agent (e.g. Codex) uses to
connect over HTTPS without MCP, repository imports, or GUI automation: the
web-session request lifecycle, the OpenAPI surface, and the typed error
handling, so an Agent can be instructed with a short claim code plus this
document.

## State and Ownership

Start state: clean `codex/web-agent-session-architecture` after WP-WA5 (`f4ea2cb`).

Owned paths:

- `docs/agent/api-usage.md` (web-session example + transport failure handling)
- `docs/agent/README.md` (link the web-session flow)
- `packages/agent-adapter/src/openapi.ts` (web-session transport paths)
- `fixtures/agent-api/agent-circuit.openapi.json` (regenerated artifact)
- `plan/2026-08-12-web-agent-session-wa6/plan.md`, one `plan/log.md` entry

Read-only / shared: the frozen transport contract (`web-agent-session.md`,
`envelope.ts`), the existing Circuit API schemas.

## Work

1. Add a "Web session example" to `api-usage.md`: claim redemption → bearer
   token → `capabilities`/`snapshot`/`transact`/`render` over the session circuit
   endpoint, with idempotent `requestId` retry and the SSE event stream.
2. Extend failure handling with the web-session transport errors
   (`SESSION_*`, `CLAIM_*`, `TOKEN_*`, `EDITOR_OFFLINE`, `RATE_LIMITED`,
   `PROJECT_REPLACED`) and the retry/idempotency rules.
3. Extend `agentCircuitOpenApi` with the web-session transport paths and
   regenerate the OpenAPI artifact; verify `agent-api:artifacts:check`.
4. Link the web-session flow from `docs/agent/README.md`.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm agent-api:artifacts:check` (after building the package)
- `corepack pnpm references:check`
- Prettier on changed docs/Markdown and `openapi.ts`

Rationale: documentation + a generated artifact. An end-to-end external-process
HTTP test requires the deployed relay (WP-WA7); here the contract is validated
by the artifact check, reference check, and internal consistency with the frozen
spec.

## Commit Intent

```text
docs(agent): external web-session client contract (WP-WA6)
```

## Outcome

Added the external-Agent usage contract. `docs/agent/api-usage.md` now has a
"Web session example" (claim → bearer token → capabilities/snapshot/transact/
render over the session circuit endpoint, idempotent `requestId` retry, SSE
events, project-replacement termination) and the web-session transport failure
catalog (`CLAIM_*`, `TOKEN_*`, `SESSION_*`, `EDITOR_OFFLINE`, `RATE_LIMITED`,
`REQUEST_TOO_LARGE`, `PROJECT_REPLACED`). `docs/agent/README.md` links it.

Extended `agentCircuitOpenApi` with the transport paths
(`/api/agent/sessions`, `/api/agent/claims/{claimCode}`,
`/api/agent/sessions/{id}/circuit` reusing the Circuit API schemas,
`/api/agent/sessions/{id}/events`, `DELETE /api/agent/sessions/{id}`) plus
`agentSessionCreated`/`agentClaimResponse`/transport-error schemas, and
regenerated the OpenAPI artifact.

Validation: `agent-api:artifacts:check` passes after rebuild; `references:check`
passes; workspace `typecheck` clean; Prettier applied. An end-to-end
external-process HTTP test requires the deployed relay (WP-WA7).
