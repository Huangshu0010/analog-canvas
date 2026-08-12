# Browser-Authorized Agent Sessions

Status: `proposed`

## Objective

Let a user authorize an external Agent such as Codex to inspect and edit the
Project currently open in the published browser editor through a small HTTPS
API. Agent operation is semantic and independent of GUI vision; deterministic
formal renders are available for optional visual review. Human and Agent edits
must enter the same revision, validation, undo/redo, Project replacement, and
recovery lifecycle.

This roadmap extends the accepted Agent Circuit API rather than introducing
MCP, a browser-automation protocol, or a second circuit command engine.

## User-visible outcome

A user opens a local Project in the web editor, clicks **Connect Agent**, grants
bounded permissions, and gives a short-lived claim link or code to Codex. Codex
can then:

1. discover the exact session capabilities;
2. read a complete semantic Snapshot of an explicitly selected Document;
3. dry-run and commit typed atomic edits;
4. receive revision-change and session-state notifications;
5. request an SVG or PNG render for review; and
6. leave every committed change in the same undo history visible to the user.

The editor shows that an Agent is connected, the permissions and expiry, the
last operation, and a one-click pause/revoke control. Closing the browser tab or
revoking access prevents further operations.

## Current repository evidence

The existing code solves the domain half of this feature but not the web-host
half:

- `packages/agent-adapter/src/schema.ts` defines the bounded v2
  `capabilities/snapshot/transact/render` protocol.
- `packages/agent-adapter/src/snapshot.ts` builds the deterministic semantic
  read model needed for non-visual reasoning.
- `packages/agent-adapter/src/service.ts` enforces permissions and limits, but
  calls `executeTransaction()` and then an independent
  `AgentDocumentStore.commitDocument()`; it is not attached to the editor's
  live history/controller lifecycle.
- `packages/agent-adapter/src/http.ts` imports Node HTTP/crypto and deliberately
  binds only to loopback. It remains useful for desktop and scripted hosts but
  cannot serve a public web editor.
- `apps/editor/src/document/document-controller.ts` owns live Project state,
  per-Document `DocumentHistory`, resolver refresh, and React synchronization,
  but accepts only GUI-originated edit arrays and constructs a human actor.
- `worker/index.ts` serves static assets and analytics. Other `/api/*` requests
  return 404; there is no Agent session, authorization, or live browser relay.

Therefore the Project/Document schemas, shared Edit Engine, Snapshot, typed
transactions, capabilities, diagnostics, and formal render are retained. The
store/commit host boundary, browser integration, authorization, transport, and
live event lifecycle require implementation.

## Frozen architectural direction

### Browser-authoritative first release

The open browser editor is the state authority for an Agent session. The relay
does not persist `.icproj`, derive connectivity, execute circuit edits, or own
undo. It only authenticates, queues, forwards, expires, and audits bounded
messages.

```text
External Agent
  -> HTTPS request / event stream
Cloudflare Worker + AgentSession Durable Object
  -> authenticated WebSocket message
Browser Agent Host
  -> EditorDocumentController dispatchTransaction(...)
  -> DocumentHistory
  -> shared Edit Engine
  -> Project update + resolver refresh + recovery + React update
```

This avoids a premature server-authoritative Project store, offline merge, or
CRDT design. The browser must remain open and online. A later collaborative
server model requires its own evidence and ADR; it is not an additive detail of
this phase.

### Three boundaries, one domain protocol

1. **Agent Circuit domain API**: `capabilities`, `snapshot`, `transact`,
   `render`; retained and transport-independent.
2. **Editor host boundary**: reads current session state and dispatches complete
   transactions through the editor controller/history.
3. **Session transport**: claim, authorization, WebSocket relay, event stream,
   expiry, idempotency, rate/size limits, and revocation. It does not invent
   circuit operations.

### Explicitly rejected approaches

- MCP or provider-specific tool discovery in product core.
- DOM selectors, synthesized pointer/keyboard input, arbitrary browser script,
  or vision as the mutation path.
- Exposing the existing Node loopback listener to a network interface.
- Accepting a writable Project, Document, Snapshot, SVG, CSS, or arbitrary file
  path from an Agent.
- A second `CommandEngine`, JSON Patch layer, or Agent-only Net/routing logic.
- Server-side long-term Project storage in the first release.
- Silent reconnection to a different Project after Open/Import/Restore.

## Session and authorization contract

### Actors and secrets

The first release does not require product accounts. It uses scoped
capabilities:

- `sessionId`: public opaque identifier; not authorization.
- `editorSecret`: high-entropy secret held only by the originating browser tab
  and used for its WebSocket channel.
- `claimCode`: one-time, short-expiry code/link shown only after explicit user
  action.
- `agentToken`: high-entropy bearer capability issued after claim, stored only
  by the Agent host, scoped to one session, Project identity, permission set,
  and expiry.

Claim codes expire after at most five minutes and are single-use. Agent tokens
default to one hour, never outlive their editor session, and are invalidated by
pause, revoke, project replacement, tab close/heartbeat expiry, or service-side
abuse controls. Secrets are never placed in analytics, URL query parameters,
logs, local recovery data, Snapshot data, or render artifacts.

### Permissions

Retain current circuit permissions and expose them as granted session scopes:

| Scope                       | Allows                                               |
| --------------------------- | ---------------------------------------------------- |
| `circuit.snapshot`          | Complete read-only Snapshot for authorized Documents |
| `circuit.render`            | Bounded formal/diagnostic render                     |
| `circuit.source-spans`      | Source locations, never raw source text              |
| `circuit.edit.geometry`     | Placement and Route geometry edits                   |
| `circuit.edit.connectivity` | Net/terminal/Route connectivity edits                |
| `circuit.edit.presentation` | Text, drafting, annotations, style intent            |

Import/export, raw project download, filesystem access, and arbitrary code are
not implied by full circuit edit. If later required, they use separate scopes
and user-visible controls.

The UI may offer friendly presets—Review, Layout Edit, Full Circuit Edit—but
the issued token contains the explicit scopes. Once granted, operations within
scope do not prompt individually. The user retains visible pause/revoke and the
shared undo history.

### Project binding

A session is bound to immutable `projectSessionId` plus a Project identity and
the authorized Document set. Switching the active Document does not implicitly
retarget Agent requests. Open, Import, Restore, or demo replacement terminates
the session; the user explicitly authorizes a new Project.

## Transport contract

The exact paths are frozen in WP-WA1, but the minimum resource model is:

```text
POST   /api/agent/sessions                 browser creates a session
POST   /api/agent/claims/{claimCode}       Agent exchanges one-time claim
POST   /api/agent/sessions/{id}/circuit    Agent sends one Circuit API request
GET    /api/agent/sessions/{id}/events     Agent receives bounded SSE events
DELETE /api/agent/sessions/{id}            Agent disconnects its capability
WS     /api/agent/sessions/{id}/editor     browser command/result channel
```

Browser creation and channel authentication use the editor secret returned
over the session-creation response. CORS is allowlisted/configurable rather
than wildcard with credentials. All responses use `Cache-Control: no-store`.
Request and response sizes reuse the Agent capabilities limits and also have
relay-level hard ceilings.

### Relay message envelope

Every forwarded operation has:

```typescript
interface AgentSessionMessage {
  protocolVersion: "1.0";
  sessionId: string;
  messageId: string;
  requestId: string;
  sentAt: string;
  kind: "circuit-request" | "circuit-response" | "event" | "cancel";
  payload: unknown;
}
```

The payload of `circuit-request` remains the existing strict Agent Circuit API
schema. The relay never interprets or rewrites typed edits.

### Serialization, idempotency, and concurrency

- One Durable Object serializes in-flight writes per session.
- `requestId` is an idempotency key for the token/session lifetime. Repeating a
  completed request returns the bounded cached result and never reapplies it.
- The browser independently deduplicates `requestId` before dispatch.
- `expectedRevision` remains the optimistic concurrency authority.
- `STALE_REVISION` returns the current revision; the Agent obtains a fresh
  Snapshot and re-evaluates rather than replaying blindly.
- Read operations may be concurrent only after deterministic response/revision
  behavior is tested. The initial implementation may serialize all operations.
- Timeout, cancellation, disconnect, and late response cannot transform an
  unknown write into an automatic retry.

### Events

SSE is sufficient for the Agent-facing event stream; the browser uses
WebSocket because commands must be delivered to it. Initial events are:

- `session.ready`, `session.paused`, `session.revoked`, `session.expiring`;
- `editor.online`, `editor.offline`;
- `document.revision-changed` with Document ID, revision, actor kind, request ID
  when applicable, and changed object IDs;
- `document.replaced`, which terminates the session;
- `operation.started`, `operation.completed`, `operation.failed`.

Selection, hover, viewport, pointer position, and in-progress gestures remain
editor-local and are not streamed. Agent requests explicitly target a Document
and render bounds.

## Browser host and mutation lifecycle

`EditorDocumentController` must accept a complete, already authenticated
transaction envelope instead of only `transact(edits)` with a hard-coded human
actor. Both entry points call one internal dispatch path:

```typescript
dispatchTransaction({
  transactionId,
  documentId,
  expectedRevision,
  actor,
  dryRun,
  edits,
}): EditTransactionResult
```

Required invariants:

- Human calls generate `{kind: "human"}` metadata; the Browser Agent Host
  supplies `{kind: "agent", id}` only after session authorization.
- `DocumentHistory.transact()` remains the one history mutation boundary.
- A successful Agent commit updates Project, resolver, React state, recovery,
  diagnostics, and revision events exactly like a human commit.
- One Agent transaction is one undo item. `dryRun` changes no history, Project,
  recovery state, or UI selection.
- Agent edits never follow current GUI focus implicitly. The requested
  `documentId` selects the matching per-Document history or returns a typed
  error.
- Opening another Cell for human viewing neither retargets nor cancels an
  explicit Agent operation. Whole-Project replacement cancels the session.
- Browser disconnect during execution returns a terminal typed transport state;
  it does not guess whether a transaction committed. The cached `requestId`
  result resolves uncertainty after reconnect if the session is still valid.

The existing Agent service must depend on this host dispatch contract instead
of independently invoking `executeTransaction()` followed by
`commitDocument()`. Snapshot and render obtain the resolver and Project at
request time, not from stale service-construction options.

## Package and source ownership target

The implementation should converge toward:

```text
packages/agent-protocol/          browser-safe schemas/types/artifacts
packages/agent-adapter/           transport-independent operation handling
packages/agent-transport-node/    optional loopback Node HTTP adapter
apps/editor/src/agent/            BrowserAgentHost + connection state
apps/editor/src/document/         shared human/Agent transaction dispatch
apps/editor/src/components/       authorization/session UI
worker/agent-session.ts           Worker routing + Durable Object relay
```

Creating both new packages is conditional on dependency inspection in WP-WA1.
The non-negotiable rule is that browser-imported modules do not depend on
`node:http`, `node:crypto`, or Node `Buffer`; the exact minimum file move should
avoid gratuitous package churn.

## Work packages

Each work package is a separate target plan and reviewable commit. Before the
first implementation package, merge the concurrent VDD rail branch to `main`,
then rebase this planning branch or create implementation branches from that
new mainline. Generated API artifacts are regenerated only in the package that
changes their source schema.

### WP-WA0 — Contract ADR and threat model

Status: `complete` — frozen in
[`ADR 0016`](../adr/0016-browser-authoritative-agent-session.md) and
[`web-agent-session.md`](../specs/web-agent-session.md).

- Goal: Freeze browser authority, session lifecycle, capability-token model,
  permission scopes, origin policy, retention, audit redaction, and typed
  transport errors.
- Main modules: `docs/adr`, `docs/specs/agent-api.md`, new web-session spec.
- Dependencies: accepted ADR 0005/0007; VDD merged first so API edit-kind
  inventory and generated artifacts are current.
- Validation: contract examples, threat table, protocol state-machine review,
  documentation links.
- Exit gate: no implementation package has an unresolved authority, identity,
  retry, expiry, or project-replacement decision.

### WP-WA1 — Browser-safe protocol boundary

Status: `complete` — browser-safe main entry (no `node:` builtins); Node
loopback moved to `./loopback`; relay envelope + web-session schemas frozen in
`packages/agent-adapter/src/{platform,envelope}.ts`.

- Goal: Separate Node-only loopback transport from schemas and operation logic
  that the browser can import; freeze relay envelopes and web-session schemas.
- Main modules: `packages/agent-adapter`, optional
  `packages/agent-protocol`/`packages/agent-transport-node`, generated schemas
  and OpenAPI fixtures.
- Dependencies: WP-WA0.
- Validation: browser-target build with no Node builtin imports; existing v1/v2
  conformance and loopback tests remain green; generated-artifact check.
- Exit gate: both a browser test harness and Node loopback host consume the same
  Circuit API schemas without conditional schema forks.

### WP-WA2 — Unified editor transaction host

Status: `complete` — `EditorDocumentController.dispatchTransaction` is the single
human/Agent write path; `AgentOperationHost` contract frozen in
`packages/agent-adapter/src/host.ts`.

- Goal: Route authenticated Agent and human edits through one
  `EditorDocumentController`/`DocumentHistory` path.
- Main modules: `apps/editor/src/document`, Agent operation host interface,
  focused controller/history tests.
- Dependencies: WP-WA1; current connectivity/routing planners and VDD power
  rail edit kinds treated as shared contracts, not duplicated.
- Validation: human/Agent parity; dry-run no-op; stale revision; per-Document
  history; one transaction/one undo; resolver and recovery refresh; Project
  replacement invalidation.
- Exit gate: no browser Agent write calls `executeTransaction()` or mutates a
  Project beside controller/history dispatch.

### WP-WA3 — In-browser Agent host without network

- Goal: Instantiate the existing Snapshot/transact/render service against live
  browser state using an in-memory authenticated test channel.
- Main modules: `apps/editor/src/agent`, editor integration boundary.
- Dependencies: WP-WA2.
- Validation: component/integration tests run all four operations against the
  active live Project; Agent commit appears in UI and undo; formal render hash
  matches direct renderer; open/import/restore invalidates host session.
- User-visible demonstration: a development-only harness edits a component
  semantically without DOM input.
- Exit gate: the complete feature works inside one browser process before
  network, token, or Worker complexity is introduced.

### WP-WA4 — Cloudflare session relay

- Goal: Implement the Worker routes and one Durable Object per session for
  claim exchange, authenticated browser channel, Agent requests, SSE events,
  bounded result cache, heartbeat, expiry, pause/revoke, and rate/size limits.
- Main modules: `worker/index.ts`, `worker/agent-session.ts`, Worker bindings and
  tests.
- Dependencies: WP-WA0/WP-WA1. It may be developed after WP-WA1 in parallel
  with WP-WA2/3 but cannot integrate before WP-WA3.
- Validation: state-machine tests with fake time; one-time claim; token scope;
  constant-time secret comparison where applicable; redacted logs; duplicate
  request dedupe; timeout/late-response behavior; editor disconnect; CORS and
  `no-store`; payload/rate limits.
- Exit gate: the relay is unable to inspect or persist a Project and cannot
  create an actor or edit outside the browser-authorized session.

### WP-WA5 — Connect Agent UI and browser transport

- Goal: Add Connect Agent, permission presets/details, claim link/code,
  connected/working/paused/offline/expiring states, recent-operation audit, and
  pause/revoke controls.
- Main modules: `apps/editor/src/agent`, focused components, styles, help text.
- Dependencies: WP-WA3/WP-WA4.
- Validation: component and Playwright flows for grant, claim, edit, visible
  result, undo, stale revision, pause, revoke, expiry, offline/reconnect, and
  project replacement. Secrets must never appear in analytics or recovery.
- Exit gate: an ordinary user can authorize and revoke without developer tools,
  and the editor never prompts per operation inside the granted scope.

### WP-WA6 — Agent client package and usage contract

- Goal: Make ordinary external Agents easy to connect without MCP by publishing
  a small OpenAPI document, examples, and optional zero-magic CLI/TypeScript
  client for claim, capabilities, Snapshot, transact, render, and events.
- Main modules: `docs/agent`, generated OpenAPI, `tools` or a narrowly scoped
  package.
- Dependencies: WP-WA5 contract stability.
- Validation: an external-process test uses only the public HTTP contract; no
  repository imports or GUI automation; error examples cover stale revision,
  permission denied, offline editor, timeout, and revoked token.
- Exit gate: Codex can be instructed with a short URL/code and API document,
  rather than repository-specific source knowledge.

### WP-WA7 — Delivery hardening and measured rollout

- Goal: Validate security, performance, reliability, and production delivery
  before enabling the feature by default.
- Main modules: end-to-end fixtures, performance scripts, release/Worker config,
  user documentation.
- Dependencies: WP-WA0–6.
- Validation: 100/500-instance Snapshot and render budgets; concurrent human
  edit/stale Agent transaction; duplicate and dropped responses; large invalid
  payload; session expiry; browser refresh; undo/recovery; required clean
  install plus `pnpm ci:check`; review branch and green GitHub checks.
- Exit gate: all acceptance scenarios below are reproducible on the deployed
  review environment and no Project content is retained by the relay after
  session cleanup.

## Acceptance scenarios

### Authorized semantic edit

```text
Browser opens a Project and grants geometry + render for one hour
-> Agent claims the one-time code and reads capabilities/Snapshot
-> Agent dry-runs and commits a move at the Snapshot revision
-> browser canvas and diagnostics update without refresh
-> Ctrl+Z restores the pre-Agent state
```

### Concurrent human edit

```text
Agent reads revision 42
-> human commits revision 43
-> Agent submits expectedRevision 42
-> operation returns STALE_REVISION and current revision 43
-> Agent obtains a new Snapshot; no old edit is replayed
```

### Retry uncertainty

```text
Agent submits requestId R and loses the HTTP response
-> it repeats the identical requestId R
-> relay/browser returns the cached terminal result
-> Document revision advances at most once
```

### Permission isolation

```text
User grants Review only
-> Agent can Snapshot and render
-> geometry/connectivity/presentation transactions return PERMISSION_DENIED
-> no browser transaction or recovery write occurs
```

### Project replacement

```text
Agent is connected to Project A
-> user imports or opens Project B
-> Project A session is revoked and document.replaced is emitted
-> the old token cannot read or edit Project B
```

### Browser offline

```text
Agent sends a request while editor WebSocket is absent
-> relay returns EDITOR_OFFLINE without queueing an unbounded write
-> reconnect does not silently apply the rejected request
```

### Render review

```text
Agent commits a typed transaction at revision N
-> requests a bounded formal render for revision N
-> receives deterministic SVG or PNG metadata and artifact
-> no DOM screenshot or browser pointer automation is needed
```

## Deterministic validation matrix

| Boundary        | Required evidence                                                      |
| --------------- | ---------------------------------------------------------------------- |
| Protocol        | strict JSON schema, generated OpenAPI, compatibility fixtures          |
| Browser safety  | build graph contains no Node builtins in browser imports               |
| Mutation parity | human/Agent result, revision, diagnostics, undo, recovery tests        |
| Authorization   | claim/token/scope/expiry/revoke state-machine tests                    |
| Reliability     | request dedupe, stale revision, timeout, disconnect, late result tests |
| Privacy         | log/analytics/recovery assertions for secrets and circuit payloads     |
| Performance     | Snapshot/render/relay budgets at 100 and 500 instances                 |
| Product         | Playwright grant-to-edit-to-undo and revoke flows                      |
| Delivery        | clean install, `pnpm ci:check`, review deployment, remote green checks |

## Risks and decisions

| Risk or decision                                                        | Handling                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent VDD rail work changes shared model/Edit Engine/API artifacts | Planning branch edits docs only. Merge VDD first; rebase every implementation target and regenerate artifacts once from the merged schema.                              |
| Agent bypasses editor undo/recovery                                     | WP-WA2 makes controller/history dispatch the only browser write path.                                                                                                   |
| Browser refresh loses session ownership                                 | Initial release revokes the session on refresh unless a secure explicit reconnect design is accepted; no token is placed in recovery/localStorage by default.           |
| Relay sees circuit payloads in transit                                  | HTTPS is required; relay does not persist payloads or log bodies. End-to-end encryption is deferred unless threat review requires protection from the service operator. |
| Capability link leaks                                                   | Single-use short expiry, explicit scopes, visible connected state, immediate revoke, no query-string analytics.                                                         |
| Duplicate request after timeout                                         | Per-session requestId dedupe at relay and browser; never blindly retry an unknown write.                                                                                |
| Multiple Agents                                                         | First release may allow one Agent token/session. Multi-Agent concurrency is deferred until a demonstrated need.                                                         |
| Snapshot too large                                                      | Retain measured complete-Document baseline; deterministic transport chunking only after evidence, never inferred semantic regions.                                      |
| UI planner remains Agent-inaccessible                                   | Audit feature-specific planners after the host works; move only genuinely shared semantic planners below UI without creating Agent-specific edit kinds.                 |
| Cloudflare availability/vendor coupling                                 | Domain protocol and Browser Agent Host remain transport-independent; Durable Object is one relay adapter.                                                               |

## Out of scope

- MCP server or model-provider integration.
- Agent planning, LLM hosting, prompt management, or autonomous policy.
- Server persistence or synchronization of `.icproj`.
- Offline Agent edits while no authorized browser is present.
- CRDT, multi-user collaborative editing, or conflict-free electrical merges.
- Remote filesystem access, arbitrary SPICE model upload, or source writeback.
- GUI selection/viewport/pointer control as Agent state.
- Vision-based editing. Formal render is only a review artifact.

## Exit gate

The web Agent feature is complete only when a deployed review build proves:

- explicit scoped authorization and revocation;
- complete semantic Snapshot and deterministic render;
- Agent transactions through the same controller/history/undo/recovery path as
  humans;
- stale-revision safety and exactly-once visible behavior under retry;
- termination on Project replacement or authorization expiry;
- no relay Project persistence, filesystem surface, DOM mutation path, MCP, or
  second Edit Engine; and
- canonical local and required remote CI gates are green.
