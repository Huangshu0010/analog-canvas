---
status: completed
experience: none
---

# Agent Golden-Path Contract Closure

## Goal

Close the four-operation browser Agent contract without adding Circuit
operations: one production request Schema, one redacted path-bearing invalid
request envelope, a short copyable golden path, explicit online OpenAPI
responses, and end-to-end regression evidence that invalid input cannot reach
the browser mutation host.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This target owns the public request boundary, browser
host dispatch choice, relay/OpenAPI response declaration, associated tests,
current Agent guidance, and plan records. It does not change Circuit edit
semantics, Project lifecycle, simulation, PVT, waveform, or design-netlist
export.

- `packages/agent-adapter/src/{service,request-contract,openapi,schema}.ts`
- `apps/editor/src/agent/{use-agent-session,connect-agent-panel}.tsx`
- `worker/agent-session.ts`
- focused Agent/worker/editor tests and generated Agent API artifacts if needed
- `docs/{agent,specs}/**`, `plan/log.md`, and this target plan

Read-only shared dependencies:

- Edit Engine transaction validation and the four-operation operation union
- session-state idempotency, claim/revoke/rotate state machine
- generated JSON schema/OpenAPI artifacts, which must be regenerated rather
  than hand-edited if source schema changes

## Work

1. Trace the public relay, browser WebSocket host, Circuit service, and
   loopback entry points. Ensure hosted traffic uses the same production v2
   parser at every layer; retain any v1/v3 parser only as an explicit local
   compatibility entry point.
2. Keep the existing `INVALID_REQUEST` transformer as the only malformed
   Circuit envelope. Ensure JSON syntax failures and schema failures are
   redacted, path-bearing where possible, and cannot forward or advance a
   revision.
3. Declare the exact HTTP response schemas for public Circuit and claim/session
   failures in generated OpenAPI; do not leave generic/untyped failure bodies.
4. Verify Copy Instructions remain the sole concise ten-step lifecycle:
   redeem, protect token, returned IDs, capabilities, Snapshot, OpenAPI,
   dry-run, same-revision commit, render/final Snapshot, exact-payload retry.
   Clarify placeholders without embedding secrets or SDK instructions.
5. Add focused contract tests for schema parity across relay/browser/service,
   OpenAPI examples/responses, no-forward/no-revision invalid handling,
   close-not-revoke, idempotency, and user-triggered Rotate Agent Access.

## Validation

- `pnpm test:local` for affected agent-adapter, worker, and editor Agent tests
- `pnpm agent-api:artifacts` then `pnpm agent-api:artifacts --check` when
  generated contract artifacts change
- `pnpm docs:check`, `pnpm typecheck`, `git diff --check`
- `pnpm verify:branch` before delivery because hosted API, UI, worker and
  generated public contract share this boundary
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(agent): enforce one hosted request contract
```

## Outcome

Hosted Circuit traffic now has one strict v2 parser at all three boundaries:
relay, browser WebSocket host, and Circuit service. The compatibility service
parser remains reachable only through the explicit local store/loopback
compatibility entry; a browser-host service always selects the production
parser, and loopback v2 prevalidates before dispatch. A malformed production
request therefore returns the
canonical v2 `INVALID_REQUEST` envelope even when it names an unsupported API
version, and cannot be forwarded or mutate a revision.

The public OpenAPI now declares the observed `404` and `504` Circuit outcomes
as well as explicit typed claim responses instead of a generic default.
Generated artifacts were regenerated. Copy Instructions keep the concise
ten-step lifecycle and now explicitly say to substitute the `sessionId`
returned by the claim response into the Circuit URL, while never displaying a
bearer token. Current Agent docs state the same request/error rule.

Validation passed: focused Agent/worker/editor tests (57 tests), browser
session E2E (including Close, reconnect, Rotate, shared undo), generated API
artifact write/check, typecheck, docs check, `git diff --check`, and
`pnpm verify:branch` (118 test files / 713 tests, workspace build, production
smoke).
