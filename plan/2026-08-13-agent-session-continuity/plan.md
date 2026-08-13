---
status: completed
experience: none
---

# Same-Project Agent Session Continuity

## Goal

Implement the next independently useful Agent takeover slice without adding a
Project-level Cell controller. A browser tab may safely recover its existing
Agent relay connection after refresh only when it still hosts the same Project
session. Project replacement, explicit revoke, expiry, and a session mismatch
remain terminal and require a new human authorization. Circuit operations stay
exactly `capabilities`, `snapshot`, `transact`, and `render`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This target owns the browser session recovery proof,
the session-hook lifecycle, related relay tests/docs, and the Agent takeover
roadmap dependency wording. It does not implement Cell creation, hierarchy
transactions, Project-level revisions/history, file resources, semantic GUI
control, simulation/PVT/waveforms, or SPICE/design-netlist export.

- `apps/editor/src/agent/use-agent-session.ts` and focused browser tests
- `packages/agent-adapter/src/session-state.ts` and focused state tests when
  its portable recovery contract needs a type
- `worker/agent-session.ts` and focused session tests only for relay evidence
- current Agent/session specs, roadmap, this plan, and `plan/log.md`

Read-only shared dependencies:

- `apps/editor/src/document/document-controller.ts`: its current immutable
  same-Project session identity is sufficient; no controller expansion
- browser Agent host and Circuit service: preserve their one strict request
  parser and one `DocumentHistory` mutation path
- external OpenAPI: remains only claim plus session Circuit

## Work

1. Define a bounded same-tab recovery record: session id, browser-only editor
   secret, Project identity/session id, scopes, and expiry; never bearer token,
   claim code, Project bytes, request/response bodies, or UI state.
2. Restore only a record matching the currently open Project session, then
   reconnect the existing authenticated browser WebSocket. Clear a malformed,
   expired, terminal, or mismatched record before any reuse.
3. Keep uncertain writes tied to their original `requestId`; reconnect does not
   generate a new request, mutate a Document, or recreate a claim/token.
4. Clear recovery proof on user revoke, session expiry/revocation, and Project
   replacement. Update docs/threat model from revoke-on-refresh to the bounded
   same-tab rule, and record Project-level Cell management as deliberately
   deferred rather than a dependency.
5. Add deterministic helper/state tests and browser/relay regression coverage
   for recovery, mismatch, terminal cleanup, and no-token persistence.

## Validation

- focused Agent session state, worker, browser-host/hook tests
- `pnpm agent-api:artifacts --check`, `pnpm docs:check`, `pnpm typecheck`, and
  `git diff --check`
- `pnpm verify:branch` because browser security, relay lifecycle, and public
  Agent behavior meet in this target
- `git status --short --branch`

## Commit Intent

```text
feat(agent): recover same-project browser sessions
```

## Outcome

Implemented bounded same-tab recovery for an already-claimed browser Agent
session. The reconnect proof holds only session id, browser editor secret,
Project/session binding, granted scopes, and expiry; it excludes bearer tokens,
claim codes, Project bytes, and Circuit request/response data. Malformed,
expired, mismatched, replaced, revoked, and terminal sessions clear the proof.
The relay now refuses terminal browser reconnection and preserves paused state.
Cell/hierarchy Project control remains explicitly deferred.

Focused recovery/session/worker/host tests (44 tests), existing browser Agent
E2E, generated Agent artifact check, docs/type/diff checks, and full branch
verification passed (119 files, 717 tests, workspace builds, production smoke).
