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
| Capability token | Scoped, expiring bearer (`agentToken`) issued after a user claim     |
| Claim            | Short-expiry code/link the user gives to the Agent                   |
| Document set     | The authorized Documents a session may target                        |

## Actors and secrets

The first release uses scoped capability tokens, not product accounts.

| Secret         | Held by          | Lifetime / use                                                                                              |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `sessionId`    | public           | Opaque session id; **not** authorization                                                                    |
| `editorSecret` | browser tab only | Authenticates the browser's WebSocket command channel; may survive one same-tab refresh in `sessionStorage` |
| `claimCode`    | user → Agent     | Expires in 30 minutes; a valid retry replaces the previous bearer                                           |
| `agentToken`   | Agent host only  | Bearer, scoped, default eight hours, never outlives the editor session                                      |

Claim codes expire after 30 minutes. Repeating a valid claim mints a replacement
token and immediately invalidates the prior bearer; the relay retains one token
verifier, so retries cannot create parallel access. Agent tokens and editor
sessions default to eight hours. They are invalidated by pause, revoke, Project
replacement, normal tab close, session expiry, or service-side abuse controls.
An abrupt browser loss makes the editor offline; the session's fixed lifetime
remains the terminal cleanup boundary.

Secrets are never placed in analytics, URL query parameters, logs, Project
recovery data, Snapshot data, render artifacts, or `Cache-Control`-able
responses. The sole exception is a bounded same-tab reconnect proof in browser
`sessionStorage`: it contains only `sessionId`, `editorSecret`, Project binding,
scopes, and expiry. It never contains a bearer token, claim code, Project bytes,
or request/response data, and is cleared on mismatch, expiry, replacement, or
revoke. All session responses use `Cache-Control: no-store`. Constant-time
comparison is used for secret/token equality where applicable.

## Permission scopes

The issued `agentToken` carries explicit scopes. The UI may offer friendly
presets (Review, Layout Edit, Full Circuit Edit); the token always contains the
explicit scope set. Within a granted scope, operations do not prompt
individually.

| Scope                       | Allows                                   | Maps to `AgentPermissions` |
| --------------------------- | ---------------------------------------- | -------------------------- |
| `circuit.snapshot`          | Complete v2 Snapshot read                | `snapshot`                 |
| `circuit.render`            | Bounded formal/diagnostics render        | `render`                   |
| `circuit.source-spans`      | Source locations, never raw source text  | `sourceSpans`              |
| `circuit.edit.geometry`     | Placement and Route geometry edits       | `edit.geometry`            |
| `circuit.edit.connectivity` | Net/terminal/Route connectivity edits    | `edit.connectivity`        |
| `circuit.edit.presentation` | Text, drafting, annotation, style intent | `edit.presentation`        |
| `editor.semantic-control`   | Temporary Cell/selection/Net/view focus  | `semanticControl`          |
| `project.download`          | Canonical `.icproj.json` download        | File Resource only         |
| `visual.download`           | Formal SVG/PNG/PDF download              | File Resource only         |
| `project.import`            | Stage/inspect/discard/import approval    | File Resource only         |

The web session's only circuit read path is the v2 Snapshot. Legacy v1 `query`
is not published by the hosted session. File Resource scopes do not imply host
filesystem access, arbitrary code, simulation, waveforms, or SPICE/design-
netlist export.

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

The published external-Agent resources are deliberately limited to:

```text
GET    /api/agent/openapi.json             public machine-readable contract
POST   /api/agent/claims                   Agent exchanges claim from JSON body
POST   /api/agent/sessions/{id}/circuit    Agent sends one Circuit API request
POST   /api/agent/sessions/{id}/files      Agent uses the named File Resource
```

- Browser session creation, control/revocation, WebSocket forwarding, and
  relay event plumbing are private implementation routes. They are not part of
  the external Agent contract and are intentionally absent from the published
  OpenAPI, so an Agent never receives or needs an `editorSecret`.
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

### File Resource

`/files` is deliberately separate from the Circuit API's four operations. A
successful `capabilities` response advertises it as `resources.file`; Agents
must obey the returned byte limit and granted scopes. It supports only
canonical Project JSON or formal SVG/PNG/PDF download, plus staging,
inspection, discard, and explicit approval request for a bounded
`.icproj.json` or virtual structural-SPICE source bundle.

The browser validates base64, declared byte length, SHA-256, virtual relative
names, duplicate names, and the existing Project/SPICE parser. Candidate bytes
and parsed Projects exist only in short-lived browser memory. The relay stores
neither candidate nor artifact bytes, and exported artifacts are one-shot:
repeating their request id returns `REQUEST_RESULT_UNAVAILABLE` rather than a
cached blob. Staging never mutates the live Project. Only the visible browser
**Replace Project** confirmation accepts it; acceptance takes the existing
Project replacement path and terminates the current Agent session.

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
  kind:
    | "circuit-request"
    | "circuit-response"
    | "file-request"
    | "file-response"
    | "event"
    | "cancel";
  payload: unknown; // typed by kind; Circuit or File Resource schema
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
  retries at 0.5, 1, 2, 4, 8, 15, and 30 seconds, then every 30 seconds until
  the session ends or the user disconnects. It never replays a Circuit request;
  `requestId` cache semantics remain the only resolution mechanism for an
  uncertain write.

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
editor-local and are never streamed. An Agent with `editor.semantic-control`
may submit one explicit non-persisting `semanticIntent` to select/highlight/fit
the live editor; that request still targets a Document explicitly and is never
recorded as a circuit transaction.

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

### Semantic editor-control contract

`transact` accepts exactly one of typed `edits`, `wireIntent`, or
`semanticIntent`. The semantic form requires `editor.semantic-control` and is
handled by the browser host's UI adapter rather than
`EditorDocumentController.dispatchTransaction()`. It accepts only the existing
Cell/Locator/Net identities: activate an existing Cell, select a canonical
hierarchy-aware locator, highlight an existing Net, fit the target Cell, or
clear focus. It returns normal transaction-shaped evidence with `applied: false`
and the unchanged revision, but creates no history item, recovery write, Project
mutation, geometry, or electrical-topology change. Missing, stale, cross-Project,
or hierarchy-mismatched targets return typed errors; coordinates and raw SVG are
not accepted.

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

| Threat                             | Handling                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claim link leaks                   | 30-minute expiry, one live bearer per session, explicit scopes, visible connected state, immediate revoke, no query-string analytics                         |
| Relay observes payloads in transit | HTTPS required; relay persists no payload and logs no body; end-to-end encryption deferred unless threat review requires it                                  |
| Replay/retry after timeout         | Per-session `requestId` dedupe at relay and browser; exactly-once visible effect; never blind-retry an unknown write                                         |
| `agentToken` theft                 | Bounded lifetime, scoped, revocable, never stored in recovery/localStorage by default                                                                        |
| Browser refresh                    | Same-tab reconnect may reuse only the bounded recovery proof when the Project binding still matches; otherwise it is cleared and reauthorization is required |
| Transient WebSocket loss           | Same-tab bounded reconnect replaces only transport; no request is replayed and Project authorization is unchanged                                            |
| Stale-revision blind replay        | `STALE_REVISION` carries current revision; Agent refreshes Snapshot and re-evaluates                                                                         |
| Editor offline during write        | `EDITOR_OFFLINE`; no unbounded write queue; reconnect never auto-applies a rejected write                                                                    |
| Project swap mid-session           | `document.replaced`; old token invalid for the new Project                                                                                                   |
| Permission escalation              | Token scopes fixed at claim; no per-op prompt inside scope; user pause/revoke always available                                                               |
| Relay compromise                   | No Project data persisted; capability-scoped; browser authoritative, so the relay cannot forge an actor or edit                                              |
| Secret in cached/logged response   | `Cache-Control: no-store`; bodies and secrets redacted from logs and analytics                                                                               |
| Multiple Agents                    | First release allows at most one Agent token per session; multi-Agent concurrency deferred                                                                   |

## Valid example

A browser opens a Project and grants `circuit.snapshot`, `circuit.render`, and
`circuit.edit.geometry` for eight hours. The Agent exchanges the claim for
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

- Browser-refresh reconnect is limited to the implemented same-tab recovery
  proof. Cross-tab restoration, token persistence, and recovery across a
  Project replacement remain out of scope.
- End-to-end payload encryption: deferred unless threat review requires
  protection from the service operator.
- Multi-Agent concurrency: deferred until demonstrated need.
- Deterministic transport chunking of large Snapshots: deferred until a real
  Document exceeds the accepted Snapshot budget (`agent-api.md`).

## Deterministic validation

- claim/token/scope/expiry/revoke state-machine tests with fake time (WP-WA4);
- claim replacement invalidates the prior token, and constant-time secret comparison;
- `requestId` dedupe at relay and browser, including timeout and late response;
- `STALE_REVISION`, `EDITOR_OFFLINE`, and `PROJECT_REPLACED` behavior;
- redacted logs/analytics/recovery assertions for secrets and circuit payloads;
- CORS/origin and `Cache-Control: no-store` assertions;
- payload and rate-limit enforcement before any forward.

## Agent v3 extension (ADR 0018)

> **Superseded:** ADR 0019 retains claim/bearer authorization and exactly four
> Circuit operations. The additional scopes, import candidate protocol, and
> continuation events below are non-normative planning history and are not an
> implemented or approved web-session surface.

[ADR 0018](../adr/0018-agent-project-lifecycle-and-v3-api.md) extends this
session contract for the Agent Project lifecycle surface. The transport,
envelope, identity, retry, expiry, and revocation rules above are unchanged;
this section freezes only the additions.

### v3 permission scopes

The six `circuit.*` scopes are retained. v3 adds only orthogonal scopes:
`project.snapshot`, `project.edit`, `project.export`, `visual.export`,
`project.import.stage`, `history.own`, and `editor.collaborate`. No scope grants
filesystem access; Project replacement is always a browser-owner approval action
and is not representable by an Agent bearer scope.

### Import candidate and approval state machine

An Agent with `project.import.stage` may submit a bounded `ImportFile` bundle
(bytes, media type, normalized relative POSIX path, encoding, size, SHA-256 as
defined in ADR 0018), never a filesystem path. The browser parses, migrates,
validates, and canonicalizes the candidate in memory and returns an opaque
`candidateId`, expiry, source hashes, Project/hierarchy summary, diagnostics,
migrations applied, and replacement consequences — without mutating Project,
history, recovery, selection, or session identity. The relay never persists
candidate or artifact bytes (`Cache-Control: no-store` continues to apply).

Replacement requires an explicit browser decision: **Cancel** (delete the
candidate, notify the Agent), **Open and disconnect** (replace Project, revoke
the old session), or **Open and reconnect Agent** (replace Project, revoke the
old session, issue a new claim with user-confirmed scopes and Document
set). The third action is explicit new authorization, not token transfer; the
old bearer token never gains access to the replacement Project. Before
replacement the editor cancels pending recovery for the outgoing Project,
revalidates the imported Project immediately before activation, and stages the
new Project's own recovery without marking it a formal save. Retry, timeout,
offline editor, late response, expiry, cancel, and page refresh are terminal and
deterministic; reusing an old `requestId` cannot reapply replacement.

### v3 events and transport codes

The terminal `document.replaced` event already exists; v3 adds an optional
bounded continuation-claim event when the user explicitly reconnects the Agent.
New transport/import codes are `IMPORT_REQUIRES_APPROVAL`,
`IMPORT_CANDIDATE_EXPIRED`, and `IMPORT_AMBIGUOUS_ENTRY`; the domain codes
`STALE_PROJECT_REVISION`, `HISTORY_DIVERGED`, `OBJECT_NOT_FOUND`, and
`ARTIFACT_TOO_LARGE` are defined in [`agent-api.md`](agent-api.md). The threat
table is extended with import-candidate leakage, ambiguous-entry coercion,
size/depth exhaustion, replacement replay, and continuation-claim isolation.
