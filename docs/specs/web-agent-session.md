# Web Agent Session

Status: `accepted`

Version: `0.1`

Owning phase: `Web Agent Session (WP-WA0–WA7)`

Primary owners: `apps/editor/src/agent`, `worker`

Related ADRs:
[`0016-browser-authoritative-agent-session.md`](../adr/0016-browser-authoritative-agent-session.md)
(freezes the architecture), [`0005-agent-api-without-mcp.md`](../adr/0005-agent-api-without-mcp.md),
[`0007-snapshot-driven-agent-workflow.md`](../adr/0007-snapshot-driven-agent-workflow.md).
This spec records the web transport, authorization, event, idempotency, host
dispatch, error, and threat contract. The Agent Circuit domain payload carried
by these messages is defined by [`agent-api.md`](agent-api.md) and is not
repeated here except where the session layer changes behavior.

## Purpose

Let a user authorize an external Agent to inspect and edit the Project open in
the published browser editor through a small HTTPS API, with human and Agent
edits entering the same revision, validation, undo/redo, and recovery lifecycle.
The browser editor remains the state authority; the relay forwards bounded
messages and persists no Project.

## Consumers

- the browser editor host (`apps/editor/src/agent`) that owns the live session;
- the Cloudflare Worker and one AgentSession Durable Object per session
  (`worker`);
- authorized external Agents (for example Codex) using only the public HTTPS/SSE
  contract;
- WP-WA1–WA7 implementation packages, which cite the frozen decisions below.

## Terminology

| Term             | Meaning                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Relay            | Worker + AgentSession Durable Object; forwards, never executes edits |
| Editor host      | In-browser `EditorDocumentController` + `DocumentHistory`; authority |
| Capability token | Scoped, expiring bearer (`agentToken`) issued after a one-time claim |
| Claim            | One-time short-expiry code/link the user gives to the Agent          |
| Document set     | The authorized Documents a session may target                        |

## Actors and secrets

The first release uses scoped capability tokens, not product accounts.

| Secret         | Held by            | Lifetime / use                                                      |
| -------------- | ------------------ | ------------------------------------------------------------------- |
| `sessionId`    | public             | Opaque session id; **not** authorization                            |
| `editorSecret` | browser tab only   | Authenticates the browser's WebSocket command channel               |
| `claimCode`    | user → Agent, once | Single-use, expires in at most five minutes                         |
| `agentToken`   | Agent host only    | Bearer, scoped, default one hour, never outlives the editor session |

Claim codes are single-use and expire after at most five minutes. Agent tokens
default to one hour, never outlive their editor session, and are invalidated by
pause, revoke, Project replacement, a normal tab close, session expiry, or
service-side abuse controls. An abrupt browser loss makes the editor offline;
the session's fixed lifetime remains the terminal cleanup boundary.

Secrets are never placed in analytics, URL query parameters, logs, local
recovery data, Snapshot data, render artifacts, or `Cache-Control`-able
responses. All session responses use `Cache-Control: no-store`. Constant-time
comparison is used for secret/token equality where applicable.

## Permission scopes

The issued `agentToken` carries explicit scopes. The UI may offer friendly
presets (Review, Layout Edit, Full Circuit Edit); the token always contains the
explicit scope set. Within a granted scope, operations do not prompt
individually.

| Scope                       | Allows                                     | Maps to `AgentPermissions` |
| --------------------------- | ------------------------------------------ | -------------------------- |
| `circuit.snapshot`          | v2 Snapshot read; v1 query read for legacy | `snapshot` (and `query`)   |
| `circuit.render`            | Bounded formal/diagnostics render          | `render`                   |
| `circuit.source-spans`      | Source locations, never raw source text    | `sourceSpans`              |
| `circuit.edit.geometry`     | Placement and Route geometry edits         | `edit.geometry`            |
| `circuit.edit.connectivity` | Net/terminal/Route connectivity edits      | `edit.connectivity`        |
| `circuit.edit.presentation` | Text, drafting, annotation, style intent   | `edit.presentation`        |

The web session's primary read path is the v2 Snapshot. v1 `query` is available
for compatibility and is gated by the `circuit.snapshot` read scope; it is not a
separate web-session scope. Import/export, raw Project download, filesystem
access, and arbitrary code are **not** implied by full circuit edit and require
separate scopes and user-visible controls if ever added.

## Project binding and replacement

A session is bound to an immutable `projectSessionId`, a Project identity, and
the authorized Document set. Switching the active Document in the editor does
not retarget Agent requests: an Agent always targets a Document explicitly, and
the host selects the matching per-Document history or returns a typed error.

Open, Import, Restore, or demo replacement terminates the session: the relay
emits `document.replaced`, the token becomes invalid for the new Project, and the
user must explicitly authorize a new session. There is no silent reconnection to
a different Project.

## Transport resource model

The minimum resources (exact paths are frozen in WP-WA1):

```text
GET    /api/agent/openapi.json             public machine-readable contract
POST   /api/agent/sessions                 browser creates a session
POST   /api/agent/claims                   Agent exchanges claim from JSON body
POST   /api/agent/sessions/{id}/circuit    Agent sends one Circuit API request
GET    /api/agent/sessions/{id}/events     Agent receives bounded SSE events
DELETE /api/agent/sessions/{id}            Agent disconnects its capability
WS     /api/agent/sessions/{id}/editor     browser command/result channel
POST   /api/agent/sessions/{id}/control    browser pause/resume/revoke/replace
```

- Browser creation and WebSocket authentication use the `editorSecret` returned
  over the session-creation response.
- A successful claim returns `sessionId`, `projectId`, and the authorized
  `documentIds` with the bearer token, so an Agent never guesses Project or
  Document identity from examples or UI labels.
- Agent requests present the `agentToken` as a bearer credential.
- CORS is allowlisted/configurable, never `Access-Control-Allow-Origin: *` with
  credentials.
- All responses use `Cache-Control: no-store`.
- Request and response sizes reuse the Agent capability limits
  (`agent-api.md`) and additionally have relay-level hard ceilings enforced
  before any forward.

## Relay message envelope

Every forwarded operation uses one envelope. The `circuit-request` payload is
the existing strict Agent Circuit API schema. The relay validates its schema,
Document binding, and required token scopes, but never applies or rewrites typed
edits or derives circuit meaning.

```typescript
interface AgentSessionMessage {
  protocolVersion: "1.0";
  sessionId: string;
  messageId: string; // unique per message
  requestId: string; // idempotency key for the token/session lifetime
  sentAt: string; // ISO-8601, set by the originator
  kind: "circuit-request" | "circuit-response" | "event" | "cancel";
  payload: unknown; // typed by kind; Circuit API schema for request/response
}
```

## Serialization, idempotency, and concurrency

- One Durable Object serializes in-flight writes per session.
- `requestId` is an idempotency key for the token/session lifetime. Repeating a
  completed request returns the bounded cached terminal result and never
  reapplies the edit. Both relay memory and the browser independently
  deduplicate `requestId` before dispatch; response bodies are never written to
  Durable Object storage.
- `expectedRevision` remains the optimistic-concurrency authority.
- On `STALE_REVISION` the response carries the current revision; the Agent
  obtains a fresh Snapshot and re-evaluates rather than replaying blindly.
- Read operations may be concurrent only after deterministic response/revision
  behavior is tested. The initial implementation may serialize all operations.
- Timeout, cancellation, disconnect, or a late response can never transform an
  unknown write into an automatic retry. After reconnect, the cached `requestId`
  result resolves whether a transaction committed; until then its state is
  unknown.
- The browser may replace a failed WebSocket transport for the same live
  session and Project using the existing in-memory `editorSecret`. Reconnection
  uses bounded exponential backoff followed by an explicit manual action. It
  never replays a Circuit request; `requestId` cache semantics remain the only
  resolution mechanism for an uncertain write.

## Events

The Agent receives a bounded SSE event stream; the browser uses WebSocket because
commands must be delivered to it. Initial events:

- `session.ready`, `session.paused`, `session.revoked`, `session.expiring`;
- `editor.online`, `editor.offline`;
- `document.revision-changed` — Document id, revision, actor kind, `requestId`
  when applicable, and changed object ids;
- `document.replaced` — terminal; the session is revoked;
- `operation.started`, `operation.completed`, `operation.failed`.

Selection, hover, viewport, pointer position, and in-progress gestures remain
editor-local and are never streamed. Agent requests target a Document and render
bounds explicitly.

## Browser host dispatch contract

`EditorDocumentController` accepts a complete, already-authenticated transaction
envelope instead of only `transact(edits)` with a hard-coded human actor. Both
human and Agent entry points call one internal dispatch path:

```typescript
dispatchTransaction({
  transactionId,
  documentId,
  expectedRevision,
  actor,        // { kind: "human" } | { kind: "agent", id }
  dryRun,
  edits,
}): EditTransactionResult
```

Invariants:

- Human calls produce `{ kind: "human" }` metadata; the browser Agent Host
  supplies `{ kind: "agent", id }` only after session authorization.
- `DocumentHistory.transact()` remains the single history mutation boundary.
- A successful Agent commit updates Project, resolver, React state, recovery,
  diagnostics, and revision events exactly like a human commit.
- One Agent transaction is one undo item. `dryRun: true` changes no history,
  Project, recovery state, or UI selection.
- Agent edits never follow current GUI focus implicitly; the requested
  `documentId` selects the matching per-Document history or returns a typed
  error.
- Browser disconnect during execution returns a terminal typed transport state;
  it does not guess whether a transaction committed. The cached `requestId`
  result resolves uncertainty after reconnect if the session is still valid.

The existing `packages/agent-adapter` service must dispatch through this host
contract instead of independently invoking `executeTransaction()` followed by
`AgentDocumentStore.commitDocument()`. Snapshot and render obtain the resolver
and Project at request time, not from stale service-construction options.

> Note (VDD increment): Route `presentation` now includes a non-electrical
> `power-rail` value; the Edit Engine requires such a Route to belong to a VDD
> Net. This value is carried transparently by Snapshot and `transact` results and
> adds no edit kind or scope.

## Typed transport errors

Errors carry a stable `code`, a human message, the current `revision` when known,
and diagnostics where applicable. "Terminal" means the token/session is no longer
usable and the Agent must not retry without re-authorization.

### Session and authorization

| Code                       | Meaning                                       | Retry / action                      |
| -------------------------- | --------------------------------------------- | ----------------------------------- |
| `SESSION_NOT_FOUND`        | Unknown or expired `sessionId`                | Terminal; re-authorize              |
| `SESSION_EXPIRED`          | Session lifetime ended                        | Terminal; re-authorize              |
| `SESSION_PAUSED`           | User paused the session                       | Wait for `session.ready`            |
| `SESSION_REVOKED`          | User or service revoked the session           | Terminal; re-authorize              |
| `PROJECT_REPLACED`         | Project was replaced; see `document.replaced` | Terminal; authorize the new Project |
| `CLAIM_INVALID`            | Claim code unknown/malformed                  | Obtain a new claim                  |
| `CLAIM_EXPIRED`            | Claim code past its short expiry              | Obtain a new claim                  |
| `CLAIM_ALREADY_USED`       | Claim code consumed (single-use)              | Obtain a new claim                  |
| `TOKEN_INVALID`            | Bearer missing/malformed                      | Terminal; re-claim                  |
| `TOKEN_EXPIRED`            | `agentToken` past its expiry                  | Ask for a newly authorized session  |
| `TOKEN_SCOPE_INSUFFICIENT` | Operation outside granted scopes              | Do not retry; request broader scope |

### Transport and state

| Code                           | Meaning                                  | Retry / action                                |
| ------------------------------ | ---------------------------------------- | --------------------------------------------- |
| `EDITOR_OFFLINE`               | Browser WebSocket absent                 | Wait for `editor.online`; do not blind-retry  |
| `EDITOR_DISCONNECTED`          | Browser left mid-operation               | Resolve via cached `requestId`; do not replay |
| `REQUEST_TOO_LARGE`            | Body exceeds relay ceiling               | Do not retry as-is; shrink payload            |
| `MESSAGE_TOO_LARGE`            | Forwarded envelope exceeds limits        | Do not retry as-is; shrink payload            |
| `RATE_LIMITED`                 | Too many requests                        | Back off; respect `Retry-After` if present    |
| `REQUEST_RESULT_UNAVAILABLE`   | Request ran; cached response was evicted | Do not replay; inspect a fresh Snapshot       |
| `UNSUPPORTED_PROTOCOL_VERSION` | `protocolVersion` unsupported            | Terminal; upgrade client                      |
| `UNAUTHORIZED_ORIGIN`          | CORS/origin policy rejected the request  | Terminal; use an allowed origin               |

### Domain (carried from `agent-api.md`)

`INVALID_REQUEST`, `PERMISSION_DENIED`, `DOCUMENT_NOT_FOUND`, `STALE_REVISION`,
`LIMIT_EXCEEDED`, `UNSUPPORTED_EDIT`, `SNAPSHOT_TOO_LARGE`, `RENDER_TOO_LARGE`,
`RENDER_FAILED` retain their meaning. `STALE_REVISION` returns the current
revision and is not terminal.

A repeated completed `requestId` is **not** an error: the relay/browser returns
the cached terminal `circuit-response`. It never reapplies the edit and never
advances the revision again.

## Invariants

- The browser editor is the state authority; the relay persists no Project,
  Document, Snapshot, or SVG.
- The relay creates no actor and applies no edit; every write is a typed
  `transact` dispatched by the browser host through `DocumentHistory`.
- A `requestId` advances a Document revision at most once for the token/session
  lifetime.
- Project replacement revokes the session; no token crosses Projects.
- Secrets never appear in analytics, URLs, logs, recovery, Snapshot, or render.
- The domain payload schema is the strict Circuit API; the relay validates
  authorization categories but never applies or rewrites typed edits.
- All session responses use `Cache-Control: no-store`.

## Threat model

| Threat                             | Handling                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Claim link leaks                   | Single-use, ≤5 min expiry, explicit scopes, visible connected state, immediate revoke, no query-string analytics            |
| Relay observes payloads in transit | HTTPS required; relay persists no payload and logs no body; end-to-end encryption deferred unless threat review requires it |
| Replay/retry after timeout         | Per-session `requestId` dedupe at relay and browser; exactly-once visible effect; never blind-retry an unknown write        |
| `agentToken` theft                 | Short TTL, scoped, revocable, never stored in recovery/localStorage by default                                              |
| Browser refresh                    | Initial release revokes the session unless a later explicit reconnect design is accepted                                    |
| Transient WebSocket loss           | Same-tab bounded reconnect replaces only transport; no request is replayed and Project authorization is unchanged            |
| Stale-revision blind replay        | `STALE_REVISION` carries current revision; Agent refreshes Snapshot and re-evaluates                                        |
| Editor offline during write        | `EDITOR_OFFLINE`; no unbounded write queue; reconnect never auto-applies a rejected write                                   |
| Project swap mid-session           | `document.replaced`; old token invalid for the new Project                                                                  |
| Permission escalation              | Token scopes fixed at claim; no per-op prompt inside scope; user pause/revoke always available                              |
| Relay compromise                   | No Project data persisted; capability-scoped; browser authoritative, so the relay cannot forge an actor or edit             |
| Secret in cached/logged response   | `Cache-Control: no-store`; bodies and secrets redacted from logs and analytics                                              |
| Multiple Agents                    | First release allows at most one Agent token per session; multi-Agent concurrency deferred                                  |

## Valid example

A browser opens a Project and grants `circuit.snapshot`, `circuit.render`, and
`circuit.edit.geometry` for one hour. The Agent exchanges the one-time claim for
an `agentToken`, reads `capabilities` and a Snapshot at revision 42, dry-runs a
move, then commits it with `expectedRevision: 42`. The relay forwards the typed
`transact` to the browser host over the authenticated WebSocket; the host
dispatches it through `DocumentHistory`, the canvas and diagnostics update, and
`document.revision-changed` (43) is emitted. `Ctrl+Z` restores the pre-Agent
state.

## Rejected example

The Agent loses the HTTP response for `requestId` `R` and repeats `R`. The relay
returns the cached terminal `circuit-response` for `R`; the Document revision
advances at most once. Separately, after a human commits revision 43, an Agent
submitting `expectedRevision: 42` receives `STALE_REVISION` with revision 43; it
refreshes the Snapshot and does not replay the old edit.

## Compatibility and migration

- No persisted Project or Document format changes; the session layer is
  additive.
- The Agent Circuit domain API, v1 query compatibility, v2 Snapshot, typed
  edits, permissions, and render contracts (`agent-api.md`) are unchanged.
- Exact endpoint paths, the Durable Object schema, and the generated web-session
  JSON schema are frozen in WP-WA1; the resource model and envelope above are
  stable.
- Changing identity, scope, retry, expiry, or replacement semantics requires a
  compatible spec revision and, when architectural, an ADR.

## Open decisions

- Browser-refresh reconnect: deferred unless a secure explicit reconnect design
  is accepted; the default remains revoke-on-refresh.
- End-to-end payload encryption: deferred unless threat review requires
  protection from the service operator.
- Multi-Agent concurrency: deferred until demonstrated need.
- Deterministic transport chunking of large Snapshots: deferred until a real
  Document exceeds the accepted Snapshot budget (`agent-api.md`).

## Deterministic validation

- claim/token/scope/expiry/revoke state-machine tests with fake time (WP-WA4);
- one-time claim, single-use enforcement, and constant-time secret comparison;
- `requestId` dedupe at relay and browser, including timeout and late response;
- `STALE_REVISION`, `EDITOR_OFFLINE`, and `PROJECT_REPLACED` behavior;
- redacted logs/analytics/recovery assertions for secrets and circuit payloads;
- CORS/origin and `Cache-Control: no-store` assertions;
- payload and rate-limit enforcement before any forward.
