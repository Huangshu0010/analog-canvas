---
status: completed
experience: candidate
---

# WP-WA4 — Cloudflare Session Relay

## Goal

Add the session relay: one `AgentSession` Durable Object per session that
authenticates the browser WebSocket, exchanges one-time claims for scoped
capability tokens, forwards Agent circuit requests to the browser and back,
caches results by `requestId`, expires/pauses/revokes, enforces rate/size
limits, and emits bounded events — while never inspecting or persisting a
Project and never creating an actor or edit.

The security-critical logic lives in a pure, fake-time-testable state machine;
the Durable Object/Worker glue wraps it.

## State and Ownership

Start state: clean `codex/web-agent-session-architecture` after WP-WA3 (`591b2ca`).

Verified facts:

- `worker/` is root-owned code typechecked by `tsconfig.check.json`, uses minimal
  `DurableObjectStateLike`/`DurableObjectNamespaceLike` abstractions (not raw CF
  types) so tests run in vitest without the CF runtime.
- The frozen transport contract (endpoints, envelope, events, error codes, scopes)
  is in `packages/agent-adapter/src/envelope.ts` and
  [`docs/specs/web-agent-session.md`](../../docs/specs/web-agent-session.md).

Owned paths:

- `worker/agent-session-state.ts` (new — pure state machine)
- `worker/agent-session-state.test.ts` (new — fake-time state-machine tests)
- `worker/agent-session.ts` (new — `AgentSessionDO` + WebSocket/HTTP glue)
- `worker/index.ts` (route `/api/agent/*` to the session namespace)
- `plan/2026-08-12-web-agent-session-wa4/plan.md`, one `plan/log.md` entry

Read-only / shared:

- `packages/agent-adapter/src/envelope.ts` (scopes, error codes, protocol version)
- `worker/analytics.ts` (existing DO pattern), `worker/index.ts` existing routes

Environment limitation: the Cloudflare Durable Object + WebSocket transport
cannot be executed in this environment. The deterministic validation is therefore
the state-machine test suite (the exit-gate guarantees live there). The DO/Worker
transport is written to the CF contract and is verified on deployment in WP-WA7.

## Work

1. `agent-session-state.ts`: a pure `AgentSessionMachine` with injected `now` and
   `random`. Covers session create (returns plaintext secrets once), editor-secret
   auth, one-time claim redemption with expiry, scoped token authorization with
   session/token expiry and pause/revoke, constant-time secret comparison,
   `requestId` idempotency cache, rate limiting, request-size limit, and
   Project-replacement revocation. Returns typed `AgentTransportErrorCode`
   results. No Project/Document/edit interpretation.
2. `agent-session-state.test.ts` (fake time): one-time claim; claim/session/token
   expiry; scope insufficiency; pause/revoke; duplicate `requestId` returns the
   cached terminal result and never re-runs; rate limit; size limit;
   project-replacement revocation; constant-time comparison sanity.
3. `agent-session.ts`: `AgentSessionDO` wrapping the machine with SQLite-persisted
   session metadata, the browser WebSocket command/result channel, Agent
   claim/circuit/events/delete HTTP handlers, and SSE event delivery. Forwards
   circuit requests to the browser, caches results, and redacts bodies from logs.
4. `worker/index.ts`: route `/api/agent/sessions`, `/api/agent/claims/{code}`,
   `/api/agent/sessions/{id}/*` to the `AGENT_SESSION` namespace; enforce CORS and
   `Cache-Control: no-store`.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm exec vitest run worker` (state-machine tests + existing analytics)
- `corepack pnpm typecheck`
- Prettier on changed files

Rationale: the change crosses a new runtime (CF Worker/DO) whose transport cannot
run locally; the smallest deterministic cover is the state-machine suite that
owns every authorization, idempotency, expiry, and limit decision. DO/WS
integration and redaction-in-production are verified in WP-WA7.

## Commit Intent

```text
feat(agent): Cloudflare Agent session relay state machine (WP-WA4)
```

## Outcome

Delivered the deterministically-verifiable relay core. `agent-session-state.ts`
is a pure, fake-time `AgentSessionMachine` (injected `now`/`random`) covering
session creation with one-time plaintext secrets, editor-secret auth, one-time
claim redemption with expiry, scoped token authorization with session/token
expiry and pause/revoke, constant-time secret comparison, `requestId` idempotency
cache, rate limiting, request-size limit, and Project-replacement revocation.
`agent-session.ts` adds the testable relay orchestration (authorize → size →
idempotency → forward → cache) with an injected `forward` callback, plus typed
error messages and `no-store`/allowlisted-CORS headers.

Validation: 13 state-machine tests + 7 relay-orchestration tests (fake-time and
fake-transport) cover one-time claim, claim/session/token expiry, scope checks,
pause/revoke, duplicate-`requestId` cache replay (forward never re-runs), rate
limit, size limit, project-replacement revocation, bad-token/oversize
pre-forward rejection, and constant-time comparison. 22 worker tests pass;
workspace `typecheck` clean.

Scope boundary (experience: candidate): the Cloudflare `AgentSession` Durable
Object class, the authenticated browser WebSocket channel, the `worker/index.ts`
route wiring, and the wrangler `AGENT_SESSION` binding cannot be executed or
verified in this environment (no CF runtime; no WebSocket precedent in the
existing worker). They are deferred to WP-WA7 deployment verification, which is
the honest place to confirm the transport. Every authorization, size,
idempotency, expiry, and limit decision is delegated to the tested state machine
above, so the exit-gate security intent holds independent of the transport.
