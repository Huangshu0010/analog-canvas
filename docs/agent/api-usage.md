# Agent API Usage

## Recommended v2 lifecycle

1. Call `capabilities` once and obey the returned operations, permissions, edit
   kinds, and byte/transaction limits.
2. Read the returned Project Index and choose one Document. Request exactly one
   complete `snapshot` for that Document; do not construct a query plan first.
3. Reason over the Snapshot's complete instance-pin/Net-terminal mapping,
   hierarchy references, placements, routes, locks, and diagnostics. Load only
   the circuit-knowledge pages relevant to the observed evidence.
4. For ordinary wiring, submit one high-level `wireIntent`; for other work,
   prepare generic typed edits. In both cases use the Snapshot revision as
   `expectedRevision` and dry-run any non-trivial transaction.
5. Inspect the dry-run diff and diagnostics, then submit the same edits without
   `dryRun` if the assumptions still hold.
6. Request a `formal` or `diagnostics` render. Repair only evidenced problems.
7. Request a fresh Snapshot before global review and handoff. On
   `STALE_REVISION`, refresh and reconsider; never blindly retry the old edit.

A successful `transact` returns `resolvedRoutes`: the post-edit resolved
polyline for each Route in `diff.changedObjectIds`. Read it to learn the actual
stored geometry — including any normalization (e.g. `set_route_points`
collapsing collinear waypoints) — without an immediate `snapshot`. A rejected
`transact` localizes the failure: each diagnostic `path` points at the failing
edit position (`["edits", index]`) or, for a Route geometry failure, at the
Route (`["routes", routeId]`), and `objectIds` names the offending object. Read
`path`/`objectIds` to pinpoint the failing edit rather than parsing the message.

The normal v2 operation surface is intentionally flat:
`capabilities`, `snapshot`, `transact`, and `render`. API v1 `query` remains a
compatibility boundary, not a recommended planning language.

## Loopback example

The desktop host creates a high-entropy token and starts the optional adapter.
Clients send one JSON operation per request:

```http
POST /v2/circuit HTTP/1.1
Host: 127.0.0.1:PORT
Authorization: Bearer HOST_GENERATED_TOKEN
Content-Type: application/json

{"apiVersion":"2.0","requestId":"cap-1","operation":"capabilities"}
```

Then request the selected Document:

```json
{
  "apiVersion": "2.0",
  "requestId": "snapshot-1",
  "operation": "snapshot",
  "documentId": "document-differential-stage",
  "includeSourceSpans": false
}
```

Do not place tokens in Project files, prompts, source netlists, or committed
configuration. Stop the listener when the Agent session ends. The request path
and body API version must match.

## Web session example (published editor)

The published browser editor exposes the same Circuit API over a browser-
authorized relay (ADR 0016). The human clicks **Connect Agent**, grants a
scoped preset, and gives the Agent a one-time claim code. The Agent never needs
repository source — only this document and the claim code.

The deployed machine-readable contract is available at
`GET /api/agent/openapi.json`. The editor's **Copy Agent connection
instructions** action includes this address, the claim endpoint, and the
one-time code.

1. **Redeem the claim** (single-use, short expiry):

   ```http
   POST /api/agent/claims HTTP/1.1
   Content-Type: application/json

   {"claimCode":"<one-time-code>"}
   ```

   On success the response carries `sessionId`, `projectId`, authorized
   `documentIds`, a scoped `agentToken` (bearer), and its expiry. Select the
   target from those returned IDs; do not guess `document-main` or infer an ID
   from a visible Cell name.
   A claim is consumed once; reuse returns `CLAIM_ALREADY_USED`.

2. **Call the Circuit API** through the session. The body is the same Circuit
   request schema as the loopback adapter; the relay forwards it to the live
   browser editor after strict schema and scope validation, without applying or
   rewriting edits:

   ```http
   POST /api/agent/sessions/{sessionId}/circuit HTTP/1.1
   Authorization: Bearer AGENT_TOKEN
   Content-Type: application/json

   {"apiVersion":"2.0","requestId":"cap-1","operation":"capabilities"}
   ```

   Then `snapshot`, `transact` (with the Snapshot revision as `expectedRevision`,
   dry-run first when useful), and `render` exactly as in the recommended v2
   lifecycle. Every request carries a unique `requestId`; bounded in-memory
   caches in the relay and authoritative browser return the same terminal
   result for a retry without persisting Snapshot/render payloads or reapplying
   the edit.

3. **Stream events** (`GET /api/agent/sessions/{id}/events`, SSE) for
   `editor.online`/`editor.offline`, `document.revision-changed`,
   `operation.started`/`completed`/`failed`, and the terminal
   `document.replaced`/`session.*` events.

The browser must remain open and online; closing the tab or revoking access ends
the session. Open/Import/Restore replaces the Project and emits
`document.replaced`; the old token cannot read or edit the new Project — request
a new authorized session.

A transient relay failure is not a revocation. The editor reconnects the same
in-memory authorization with bounded backoff and exposes a manual **Reconnect**
action. Wait for `editor.online`; never replay an uncertain write under a new
`requestId`.

## Failure handling

- `INVALID_REQUEST`: repair the payload against the checked schema.
- `PERMISSION_DENIED`: request narrower authority or ask the human/host for a
  new authorized session; do not route around it.
- `LIMIT_EXCEEDED`: split a transaction. Do not drop electrical edits silently.
- `SNAPSHOT_TOO_LARGE`: select a smaller hierarchical Document. The API does
  not fall back to a selector/query DSL.
- `STALE_REVISION`: request a fresh Snapshot and reconsider the edit.
- `EDIT_PRECONDITION`: preserve current state and explain the rejected
  assumption, including lock or pin-map conflicts.
- `RENDER_TOO_LARGE`: request smaller render bounds.

Web-session transport errors (published editor only):

- `CLAIM_INVALID` / `CLAIM_EXPIRED` / `CLAIM_ALREADY_USED`: ask the human for a
  fresh claim code; a claim is one-time and short-lived.
- `TOKEN_INVALID` / `TOKEN_EXPIRED`: request a newly authorized session from
  the human; a consumed claim cannot mint a second token.
- `TOKEN_SCOPE_INSUFFICIENT`: do not retry the same operation; request broader
  scope from the human.
- `SESSION_PAUSED`: wait for `session.ready`; the human paused the session.
- `SESSION_REVOKED` / `SESSION_EXPIRED` / `PROJECT_REPLACED`: terminal; stop and
  request a new authorized session.
- `EDITOR_OFFLINE`: the browser tab is absent; wait for `editor.online` and do
  not blind-retry an unknown write. After reconnect, a repeated `requestId`
  resolves whether a transaction committed.
- `RATE_LIMITED`: back off and retry, respecting `Retry-After` when present.
- `REQUEST_TOO_LARGE`: shrink the payload; the relay enforces a hard ceiling.
- `REQUEST_RESULT_UNAVAILABLE`: that `requestId` already ran but its response
  cache was evicted; do not replay it. Read a fresh Snapshot to resolve state.

No error authorizes filesystem access, raw Project replacement, or a fallback
mutation mechanism.
