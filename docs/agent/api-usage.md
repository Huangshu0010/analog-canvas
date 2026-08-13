# Agent API Usage

## One production lifecycle

1. Call `capabilities` once and obey the returned operations, permissions, edit
   kinds, and byte/transaction limits.
2. Read the returned Project Index and choose one Document. Request exactly one
   complete `snapshot` for that Document; do not construct a query plan first.
3. Reason over the Snapshot's complete instance-pin/Net-terminal mapping,
   explicit Net `powerDomain`, hierarchy references, placements, routes, locks,
   and diagnostics. Never infer supply identity from a label, symbol, or Net
   ID. Load only the circuit-knowledge pages relevant to the observed evidence.
4. For ordinary wiring, submit one high-level `wireIntent`; for other work,
   prepare generic typed edits. In both cases use the Snapshot revision as
   `expectedRevision` and dry-run any non-trivial transaction.
5. Inspect the dry-run diff and diagnostics, then submit the same edits without
   `dryRun` if the assumptions still hold.
6. Request a `formal` or `diagnostics` render. Repair only evidenced problems.
7. Request a fresh Snapshot before global review and handoff. On
   `STALE_REVISION`, refresh and reconsider; never blindly retry the old edit.

When capabilities reports `semanticControl: true`, an Agent may submit one
`transact.semanticIntent` to make review visible in the browser: select a
canonical locator, highlight a Net, activate or fit an existing Cell, or clear
focus. Use snapshot-returned IDs and hierarchy paths, never canvas coordinates.
Semantic results always have `applied: false` and leave revision, undo, and
Project data unchanged.

When capabilities advertises `resources.file`, use the separate File Resource
instead of inventing a Circuit operation. `download` returns only canonical
Project JSON or formal SVG/PNG/PDF. `stage` accepts a bounded `.icproj.json` or
structural-SPICE virtual source bundle, but does not mutate the live Project;
call `inspect`, then `request-approval`. The human must select **Replace
Project** in the browser. No file request provides filesystem access,
simulation, waveform data, or design-netlist export.

A successful `transact` returns `resolvedRoutes`: the post-edit resolved
polyline for each Route in `diff.changedObjectIds`. Read it to learn the actual
stored geometry — including any normalization (e.g. `set_route_points`
collapsing collinear waypoints) — without an immediate `snapshot`. A rejected
`transact` localizes the failure: each diagnostic `path` points at the failing
edit position (`["edits", index]`) or, for a Route geometry failure, at the
Route (`["routes", routeId]`), and `objectIds` names the offending object. Read
`path`/`objectIds` to pinpoint the failing edit rather than parsing the message.

The production operation surface is exactly `capabilities`, `snapshot`,
`transact`, and `render`. Do not invent a validation, planning, compilation, or
fallback mutation endpoint. The deployed OpenAPI examples identify the current
request version; API v1 `query` is compatibility history, not a production
planning language.

For a hosted session, treat the published OpenAPI as the only request contract.
An HTTP `400` is an `INVALID_REQUEST` Circuit envelope: correct every returned
diagnostic `path`, then retry with a fresh `requestId`. Never retry a changed
payload under an old `requestId`; an invalid request was not forwarded or
committed.

## Local development only: loopback example

The desktop host may start the optional loopback adapter for repository-local
development. It is not published in the browser OpenAPI and is never part of
the hosted Agent authorization workflow. External Agents must use the hosted
session flow below, not this endpoint.

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
scoped preset, and gives the Agent a short-lived claim code. The Agent never needs
repository source — only this document and the claim code.

The deployed machine-readable contract is available at
`GET /api/agent/openapi.json`. The editor's **Copy Agent connection
instructions** action includes this address, the claim endpoint, and the
claim code.

1. **Redeem the claim** (30-minute expiry):

   ```http
   POST /api/agent/claims HTTP/1.1
   Content-Type: application/json

   {"claimCode":"<claim-code>"}
   ```

   On success the response carries `sessionId`, `projectId`, authorized
   `documentIds`, a scoped `agentToken` (bearer), and its expiry. Select the
   target from those returned IDs; do not guess `document-main` or infer an ID
   from a visible Cell name.
   Repeating a still-valid claim is safe for recovery: it returns a fresh token
   and immediately invalidates the earlier bearer. Keep only the latest response.

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

3. **Use File Resource only when its scope is present**:

   ```http
   POST /api/agent/sessions/{sessionId}/files HTTP/1.1
   Authorization: Bearer AGENT_TOKEN
   Content-Type: application/json

   {"apiVersion":"2.0","requestId":"download-project-1","operation":"download","artifact":"project"}
   ```

   Do not treat staging as an import. It only returns a candidate summary;
   replacement requires the browser-human confirmation and ends this session.

The browser must remain open and online; closing the tab or revoking access ends
the session. Open/Import/Restore replaces the Project and emits
`document.replaced`; the old token cannot read or edit the new Project — request
a new authorized session.

A transient relay failure is not a revocation. Do not replay an uncertain write
under a new `requestId`; repeat the original request ID to recover its terminal
result, or request a fresh Snapshot after the browser is available again.

Hiding the Agent details does not pause, revoke, or disconnect the live session.
If the Agent loses its bearer, it may redeem the still-valid claim again; the
new token replaces the old bearer. The user may also choose **New connection**
to create a separate session with the same Project, authorized Documents, and
scopes.

## Failure handling

- `INVALID_REQUEST`: repair every reported `SCHEMA_VIOLATION` at its machine-
  readable `path`, then submit a new dry run. The response never echoes the
  rejected value. Malformed JSON uses the same envelope without a fabricated
  field path.
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

- `CLAIM_INVALID` / `CLAIM_EXPIRED`: ask the human for a fresh claim code.
- `TOKEN_INVALID`: if the original claim is still valid, redeem it again and
  replace the cached token; otherwise ask the human for a new connection.
- `TOKEN_EXPIRED`: request a newly authorized session from the human.
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
