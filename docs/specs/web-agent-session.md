# Web Agent Session

Status: `accepted`

Primary owner: `worker/agent-session.ts` and `apps/editor/src/agent`

The browser Project is authoritative. A user creates a bounded session and
chooses scopes. The relay returns a short-lived pairing code; claim redemption
returns `sessionId`, authorized `documentIds`, a short-lived bearer, and a
session-bound connector credential. A still-valid claim may be redeemed again
only to rotate both credentials. Bearers are never persisted. The local MCP
Helper may persist the connector in the user's private profile; the relay
stores only its verifier, and session revoke invalidates both credentials.

## Resources

```text
GET  /api/agent/kit
POST /api/agent/claims
POST /api/agent/connectors/resume
POST /api/agent/sessions/{sessionId}/circuit
POST /api/agent/sessions/{sessionId}/files
GET  /api/agent/openapi.json
```

`GET /api/agent/kit` is one small public, static JSON download for the Agent's
private scratch folder. It contains `README.md`, `AGENTS.md`, one session
`SKILL.md`, concise authoring rules, and a reviewed built-in Razavi catalog
projection. It contains no Project data, claim code, token, or mutation
operation; it is not part of the Circuit OpenAPI. The catalog supplies only
known built-in authoring facts before first placement; a Snapshot remains the
authority for every object in the live Project. The Agent fetches the Kit only
when a human gives it a connection setup, then writes the listed files locally
before redeeming the claim.

The Circuit resource implements only API 2.0
`capabilities/snapshot/transact/render`. The File Resource implements only
advertised bounded Project/formal-artifact download and Project/structural-
SPICE candidate staging flows. No endpoint provides arbitrary filesystem,
code-execution, simulator, waveform, query, dynamic catalog-snapshot, or
whole-Project mutation access.

## Binding and authority

A session binds one browser `projectSessionId`, one Project identity, an exact
Document allowlist, scopes, expiry, and editor secret. The Agent uses only the
`sessionId` and `documentIds` returned by the latest successful claim. Switching
the active browser Document never retargets a request.

Open, Import, Restore, or demo replacement revokes the old session. File
Resource staging is isolated and does not replace the Project. A valid staged
candidate can replace it only after explicit human approval in the editor;
replacement then revokes the session and requires a new authorization.

## Transport state machine

The official thin browser states are:

```text
idle -> creating -> waiting-for-agent -> connected <-> working
connected -> paused -> reconnecting -> connected
connected|working -> offline -> reconnecting
any live state -> revoked|expired
```

Only declared transitions are applied. Heartbeats detect a stale transport;
bounded exponential reconnect keeps the same Project/session binding. Bearer
tokens remain Agent-side only; browser recovery stores only the editor-side
session record required for same-browser reconnect.

## Idempotency and revisions

Each request ID is bound to the canonical exact payload hash. An exact retry
returns the cached terminal response or resumes the same pending request; a
different payload under the same ID returns `REQUEST_ID_REUSED`. Relay and
browser caches are bounded by entry count, bytes, and session lifetime.

Circuit edits target one exact Document revision. Dry-run and commit share the
same validation path. On `STALE_REVISION`, uncertain write outcome, reconnect,
or human revision event, the Agent refreshes Snapshot state and reconciles
before deciding what to do; it never blindly changes and replays a request.

## Permissions

Circuit permissions independently cover Snapshot, render, source spans,
geometry, connectivity, presentation, and temporary semantic editor control.
File permissions independently cover Project download, visual download, and
candidate staging. The relay checks bearer token, session/document binding,
scope, expiry, body size, and rate limits before forwarding.

Semantic editor control may select a canonical locator, highlight a Net,
activate/fit an existing Cell, or clear focus. It never advances revision,
enters undo history, or changes Project data.

## Security and failure behavior

- Claim codes and tokens use constant-time comparison and redacted telemetry.
- Responses use `Cache-Control: no-store`; payloads and secrets are excluded
  from analytics and recovery.
- Browser offline, revoked, expired, replaced, connector-invalid, permission-denied, stale-
  revision, invalid-request, and request-ID-reuse failures are typed.
- Revoke is locally terminal even when the relay is unreachable.
- CORS/origin, payload, rate, cache, expiry, and reconnect behavior are covered
  by deterministic Worker/browser tests.
