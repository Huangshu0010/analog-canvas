# Four-Operation Agent Takeover Completion

Status: `accepted implementation roadmap`

Date: `2026-08-13`

Primary owners: `packages/model`, `packages/edit-engine`,
`packages/agent-adapter`, `apps/editor/src/agent`, `apps/editor/src/document`,
`apps/editor/src/features`, `worker`, and `packages/exporters`

Related authorities: [`ADR 0019`](../adr/0019-four-operation-agent-golden-contract.md),
[`agent-api`](../specs/agent-api.md),
[`web Agent session`](../specs/web-agent-session.md),
[`project file`](../specs/project-file-format.md), and
[`formal export`](../specs/export.md).

## Outcome

An authorized external Agent can create, inspect, revise, import, save, and
formally review a browser-hosted circuit Project without DOM automation,
pointer/keyboard synthesis, repository access, MCP, simulation, PVT, waveform
or measurement data, or SPICE/design-netlist export.

The browser remains the sole Project authority. Human and Agent edits use the
same validated model, history, recovery, diagnostics, and revision boundary.

## Non-negotiable shape

The public Circuit API remains exactly:

```text
capabilities -> snapshot -> transact -> render
```

- `snapshot` is the sole source of current circuit facts.
- `transact` is the sole validation (`dryRun`) and mutation path.
- `render` is the sole visual review path.
- No `query`, `plan`, `validate`, `compile`, `artifact`, or `collaborate`
  Circuit operation is introduced.

Project-file download/upload cannot be disguised as a circuit edit or a
render. After an ADR amendment, it may use one scoped, browser-owned **File
Resource** with bounded byte payloads. This is a transport resource, not a
fifth Circuit operation and never exposes paths, server persistence, or raw
filesystem access.

## Scope decision and current baseline

The product needs a complete editing and review loop, not a simulation service
or a remote filesystem. The following boundary is therefore frozen for this
roadmap:

| Capability | Delivery decision | Authority / API shape |
| --- | --- | --- |
| Read a complete Document | Deliver | `snapshot` |
| Atomic Document edits and wiring | Deliver | `transact` through the shared Edit Engine |
| Formal visual evidence | Deliver | `render` (SVG) and File Resource visual download (SVG/PNG/PDF) |
| Project create/open/save/export | Deliver | browser-owned Project controller and scoped File Resource |
| Structural SPICE import | Deliver | staged File Resource candidate, then explicit human approval |
| `.icproj.json` import/export | Deliver | staged File Resource candidate / canonical Project download |
| Active Cell, selection, Net highlight, fit view | Deliver | non-persisting semantic intents inside `transact` |
| Agent own-head undo/redo and semantic duplicate | Deliver | typed `transact` intents and shared history |
| Simulation, PVT, analyses, waveform/measurement data | Do not deliver | no scope, endpoint, Snapshot field, or File Resource kind |
| SPICE/Spectre/design-netlist export | Do not deliver | no scope, endpoint, download kind, or capability |
| Arbitrary paths, filesystem enumeration, Project database, DOM automation | Do not deliver | rejected at the File Resource and session boundary |

As of this roadmap, production v2 has the strict four-operation request parser,
revisioned single-Document Snapshot/transaction/render path, browser claim and
relay transport, and formal SVG result. It does **not** yet provide a complete
Project lifecycle, file candidate workflow, durable same-Project reconnect,
cross-Document history semantics, or semantic GUI-control intents. Existing
v1/v3 parser/code/spec fragments are compatibility or historical material, not
production capabilities.

## Scope

Included:

- finishing the single-authority model migrations needed for exact reads and
  safe writes;
- Project, Document, Port, and hierarchy transactions under `transact`;
- Agent-safe own-head undo/redo and semantic connected-subgraph duplication;
- canonical `.icproj.json` download, formal SVG/PNG/PDF download, and staged
  Project/SPICE import via the File Resource;
- human-approved replacement and explicit reauthorization;
- semantic active-Cell, selection, Net highlight, and fit-view commands carried
  as typed `transact` intents with no persisted effect;
- generated OpenAPI, copied workflow, error/scopes/limits, and deployed E2E
  delivery evidence.

Excluded:

- simulation, analyses, PVT, waveform/measurement data;
- SPICE, Spectre, or design-netlist export;
- arbitrary filesystem access, source writeback, server Project storage,
  offline writes, CRDT, and multi-user editing;
- DOM, screenshot, pointer, or keyboard-driven Agent mutation.

## Delivery sequence and exit gates

| Order | Package | Single authority to establish | Exit gate |
| --- | --- | --- | --- |
| M0 | Power identity | `Net.powerDomain` | Completed in schema v5; no production supply identity is inferred from labels or symbols. |
| M1 | Port presentation | first-class `Port.presentation` | Every live Port has one electrical/visual record; no product or Agent port-symbol authoring remains. |
| M2 | Text and attachment | required RichText AST + one `VisualAnchor` | GUI, Agent, render/export, clipboard and hit-test use no string/markup or `routeAttachment` fallback. |
| M3 | Typed netlist facts | `Document.netlist` / `Instance.netlist` | Every writable netlist fact is typed, visible in Snapshot, and no runtime `spice.*` fallback is consulted. |
| M4 | Compatibility corpus | tested sequential migrations | Shipped fixtures and representative projects rewrite to current form with topology and render stability evidence. |
| A1 | Project controller | one browser-owned `EditorProjectController` | GUI and Agent cannot create/rename/remove Documents or repair hierarchy through a second mutable path. |
| A2 | Session continuity | one session state machine | Claim, reconnect, refresh, pause, rotate, revoke, replacement and uncertain write states have deterministic outcomes. |
| A3 | File Resource | one bounded in-memory candidate/artifact broker | Project/visual bytes flow through declared kinds, hashes and limits, never paths or hidden storage. |
| A4 | Semantic collaboration | one shared editor semantic controller | Agent navigation/highlight/fit use the same resolved connectivity and locator service as GUI without persistence. |
| A5 | History and duplication | one project-aware history/closure planner | Agent own-head undo/redo and duplicate have the same topology-safe semantics as the GUI. |
| A6 | Contract hardening | generated OpenAPI + external-client proof | All supported flows are discoverable, scoped, load-tested, and deploy-tested; no excluded feature leaks into capabilities. |

Each M target is a separate schema migration and must complete before a new
Agent write relies on it. Existing legacy forms remain read-only compatibility
until their migration has passed fixtures and real Project samples. Each A
target is a separate target plan and cannot be marked complete merely because
its transport/schema scaffolding exists: it must have a consumer path, an error
contract, and the exit evidence stated below.

## Work packages

### M1 — First-class Port presentation

Add a Port-owned presentation discriminant covering hollow/filled visual form,
lead direction, label policy, and placement. Migrate `port` and `port-filled`
instances into real Ports, replace GUI palette insertion with one `create_port`
intent, and retain retired symbols only for one reader migration.

Exit: a Port is represented once in Snapshot, one typed transaction creates or
edits it, renderer/export consume the same record, and no editable Project
needs a port-symbol instance for electrical or visual meaning.

### M2 — Required RichText and one attachment model

Make `content: RichTextDocument` required for every editable annotation and
drafting text. Migrate each legacy `text` value once into an AST; delete
underscore/markup parsing from runtime rendering. Canonicalize all attached
annotations through `VisualAnchor`; migrate or remove legacy
`routeAttachment`, never persist both.

Exit: GUI, Agent, SVG, PNG/PDF, hit testing, copy/paste, and export all use
one RichText AST and one resolved anchor result.

### M3 — Typed netlist authority

Inventory every persisted `spice.*` consumer. Migrate known facts into typed
`Document.netlist` and `Instance.netlist`, preserve unrecognized source facts
as immutable import provenance, then delete runtime fallback reads/writes.
This does not add netlist export.

Exit: Snapshot exposes every writable typed fact; the Agent authoring schema,
GUI, ERC, hierarchy validation, and future SPICE import have no second
runtime source.

### M4 — Compatibility and asset retirement

Create one migration suite that opens every shipped fixture and representative
real Project, asserts semantic/topology stability, and rewrites to the current
schema. Only after that may obsolete VDD/Port/text/netlist compatibility assets
and helpers be deleted.

Exit: retained legacy data has one tested migration; current Projects contain
only current authority forms.

## Responsibility map and interface inventory

The table is deliberately a map of **owners**, not a list of helpers an Agent
may call. A future package may add an internal helper only when it consumes one
of these authorities.

| User-visible need | One implementation owner | Agent-facing evidence / command | Delivery package |
| --- | --- | --- | --- |
| Discover allowed work | capability registry derived from schemas and session scopes | `capabilities` | A6 |
| Read circuit, hierarchy and current diagnostics | Snapshot serializer plus Project header | `snapshot` | current, M1–M4, A1 |
| Add/move/connect/delete circuit objects | Edit Engine + routing planner | typed `transact` / `wireIntent` | current, M1–M4 |
| Create/manage Documents and hierarchy | `EditorProjectController` | typed Project `transact` edits | A1 |
| Inspect final appearance | formal renderer/exporters | `render` | current |
| Save a portable Project | canonical project serializer | File Resource `project` download | A3 |
| Save formal drawing | SVG/PNG/PDF exporters | File Resource `visual` download | A3 |
| Import Project or structural SPICE | import parser and migration chain | File Resource stage + browser approval | M4, A3 |
| Review an Agent's focus in the canvas | editor semantic controller | non-persisting `transact` intent + SSE | A4 |
| Undo Agent's latest still-current action | project-aware history | `undo_own_head` / `redo_own_head` intent | A5 |
| Keep a granted Agent connected across transient breaks | session state machine | SSE state / same `requestId` result | A2 |

The File Resource is discovered through `capabilities` as scoped resource
descriptors, including max bytes, supported media types, candidate lifetime and
the exact upload/download URLs for the current session. It has no generic
`file` RPC, no command string, no raw path argument, and no permanent server
storage. A resource response is always a small descriptor; bytes are carried
only over the declared file transfer request.

## Required implementation targets

Each row is one future target-plan/commit series, not permission to implement
the entire roadmap in one change.

| Target | Main owned paths | Required behavior | Must not regress |
| --- | --- | --- | --- |
| M1 | model migration, edit engine, renderer, catalog, Agent Snapshot | first-class Port visual/electrical lifecycle | existing Port connectivity, external-port rendering, old Project opening |
| M2 | model annotation/drafting schema, text editor, renderer, clipboard, Agent schema | AST-only RichText and one attachment record | existing labels, current arrow and drawing-object positioning |
| M3 | model/import/netlist facts, ERC, hierarchy, Snapshot | typed netlist facts and immutable provenance | structural SPICE import, round-trip source-status behavior, pin order |
| M4 | migrations, fixtures, generated legacy readers | rewrite all supported old data then delete retired runtime forms | topology hash, formal output baseline, explicit source provenance |
| A1 | project controller, history host, agent host, schema/OpenAPI | atomic Project edits and hierarchy repair | single-Document GUI/Agent transaction parity, undo, recovery |
| A2 | relay state, browser session hook/panel, session tests | same-Project resume and deterministic terminal states | single-use claims, scope checks, exact-once request IDs |
| A3 | worker file handlers, import/export adapters, GUI approval panel | bounded project/visual download and staged import | no raw paths, no implicit Project replacement, no retained bytes |
| A4 | locator/connectivity/highlight services and editor shell | shared visible Agent focus | no persisted change, no revision/history/recovery impact |
| A5 | history, duplicate planner, clipboard integration, Agent adapter | safe own-head history and connected duplication | human undo order, route/Junction/NoConnect/remapped anchors |
| A6 | OpenAPI generator, docs, external fixture, CI/deployed E2E | public discoverability and production evidence | wire JSON, error envelope, excluded-capability absence |

### A1 — Project lifecycle under `snapshot` and `transact`

Amend ADR 0019 before implementation. Add a browser-owned
`EditorProjectController` with `projectRevision`, project session identity,
atomic multi-Document validation, one history item, one recovery schedule, and
deterministic selection/active-Document pruning.

`transact` gains typed Project edits—not another operation—for Project/Document
create, rename, remove, top-document selection, ordered Cell interfaces, and
hierarchy binding/repair. A request carries the Project revision and every
affected Document revision. Deletion rejects dangling Routes, Nets, NoConnects,
interface order, and caller mappings unless the same atomic request repairs
them.

The controller is the only owner of Project replacement, Document map/order,
active-Document pruning, composite revision, hierarchy reference validation,
one composite history item, recovery scheduling, and revision events. The
existing `DocumentHistory` remains its per-Document implementation detail; no
React component, relay, or Agent adapter writes a Project collection directly.
`snapshot` stays Document-complete and gains a small deterministic Project
header rather than a second project-read operation.

Exit: no GUI or Agent handler structurally mutates a live Project outside this
controller; stale/rollback/hierarchy-repair cases are deterministic.

### A2 — Stable session continuity, claim recovery, and replacement

Replace the current browser-hook lifecycle with one explicit session state
machine shared by the panel, browser host, and relay:

```text
idle -> authorizing -> claimable -> claimed -> online
                            |           |        |
                            v           v        v
                        expired      paused <-> reconnecting
                                        |             |
                                        v             v
                                  revoked/replaced  offline
```

The state machine distinguishes a transport break from authorization loss. A
same-tab reload may restore only the browser's `sessionId` and `editorSecret`
from `sessionStorage`, then prove the unchanged `projectSessionId` to the
relay. It never stores the Agent bearer or Project bytes in browser recovery or
local storage. Project open/import/restore, explicit revoke, expiry, or a
project-session mismatch is terminal and destroys that recovery record.

An uncertain mutation is resolved only by the same `requestId`: the browser and
relay each retain bounded terminal-result evidence. Reconnect never replays a
write under a fresh ID. The UI exposes compact connection state, a manual
Reconnect action only for recoverable states, Rotate for a fresh Agent bearer,
and a distinct terminal explanation for reauthorization. Closing the panel is
not a disconnect.

Exit: fake-time/browser-reload/relay-drop tests prove claim-once, exact-once
mutation, same-Project resume, terminal replacement, scoped rotation, and no
secret leakage. The panel's displayed state is a projection of this machine,
not an independent interpretation.

### A3 — Browser File Resource and human-approved import

This package requires the A1 ADR amendment. Add one scoped browser-memory File
Resource beside—not inside—the four Circuit operations. Its allowed kinds are
exactly:

| Direction | Kind | Result |
| --- | --- | --- |
| download | `project` | canonical `.icproj.json` for a named Project revision |
| download | `visual` | formal SVG, PNG, or PDF for one Document/revision |
| stage upload | `project` | parsed/migrated `.icproj.json` candidate |
| stage upload | `structural-spice` | bounded structural SPICE candidate with confined includes |

The File Resource accepts bytes, declared media type, normalized relative
virtual filename, byte length, and SHA-256. It rejects filesystem paths, URLs,
directory traversal, duplicate/case-colliding names, archive execution, future
schemas, oversized/deep include graphs, hash mismatches, and all
simulation/model-analysis payload classes. Staging never changes Project,
history, recovery, active selection, or Agent authorization.

Only the browser owner can choose **Cancel**, **Open and disconnect**, or
**Open and reconnect Agent** after candidate summary, migrations, diagnostics,
hierarchy impact and content hashes are visible. A successful replacement
revokes the old Project-bound capability; reconnection issues a new one-time
claim and never transfers a bearer. Downloaded bytes are generated from the
requested validated revision and return media type, SHA-256 and byte length.
The relay forwards bytes but retains none.

Exit: GUI and Agent produce byte-identical canonical project and visual
artifacts; staged candidates have identical summaries from identical bytes;
approval/replacement/revocation and every size/path/hash rejection are covered
without creating a netlist-export endpoint.

### A4 — Semantic collaboration through `transact`

Add non-persisting `transact` intents for:

- activate a permitted Document/Cell;
- select canonical `ObjectLocator` records;
- highlight one resolved Net and its complete visible connectivity set;
- fit to selected objects, a Net, bounds, or an entire Document;
- clear the Agent semantic focus.

They consume the existing Object Locator, connectivity index, route geometry,
and Net-highlighting service—never coordinates re-derived by the relay or the
Agent adapter. They require `editor.semantic-control`, return resolved
objects/bounds/Net evidence, emit an audit/SSE event, and do not modify model
data, document/project revision, history, recovery, topology hash, or formal
output. GUI and Agent must render the exact same highlight layer and visual
selection, including hierarchy navigation failures.

Exit: a human can immediately see, through existing editor controls, which
objects or Net an Agent reviewed; wrong, stale, inaccessible, and deleted
locators return the same typed result to GUI and Agent.

### A5 — History and semantic duplication

Move connected-subgraph closure, ID remapping, Route/Junction/NoConnect and
RichText-anchor remapping beneath React. Add `undo_own_head` and
`redo_own_head` intents that can act only on the requesting Agent's shared
history head; otherwise return `HISTORY_DIVERGED` with current evidence.

Exit: Agent and GUI duplication produce equivalent connected selections, and
an Agent cannot skip or undo intervening human work.

### A6 — Public contract and delivery hardening

Publish only current v2 Circuit schemas and examples, capability-derived edit
and intent registries, File Resource schemas, limits, error catalogue,
claim/reconnect/file workflows, and a no-repository external-client fixture.
Use `$defs`/`$ref` in generated OpenAPI only if the wire JSON remains unchanged.
Add scale budgets for 100/500-instance Snapshot, Project transaction, import,
and visual export.

Exit: a generic OpenAPI client can discover all in-scope workflows from the
claim instruction; frozen install, `pnpm ci:check`, deployed review E2E, and
required remote checks are green.

## Protocol surface to freeze before A1

The Circuit request schema remains v2 and exactly four operations:

```text
capabilities | snapshot | transact | render
```

Project lifecycle, semantic intents, own-head history, and duplication are
typed `transact` payloads. They carry an expected Project/Document revision as
applicable and return the existing redacted diagnostic envelope. File transfer
is a separate scoped HTTPS resource with its own OpenAPI paths; it is not a
fifth Circuit operation and cannot accept a circuit mutation.

The implementation plan must amend ADR 0019 and the web-session spec together
before A1/A2/A3 code changes. It must delete or mark non-production all
conflicting v3/legacy documentation in the same delivery target, rather than
asking external Agents to infer which of two interfaces is current.

## Scopes and terminal errors

New scopes are orthogonal to current circuit scopes:

```text
project.lifecycle
history.own
file.project.read
file.visual.read
file.import.stage
editor.semantic-control
```

Key errors: `STALE_PROJECT_REVISION`, `HISTORY_DIVERGED`,
`IMPORT_REQUIRES_APPROVAL`, `IMPORT_CANDIDATE_EXPIRED`,
`IMPORT_AMBIGUOUS_ENTRY`, `FILE_TOO_LARGE`, `FILE_HASH_MISMATCH`, and
`OBJECT_NOT_FOUND`. Add `PROJECT_SESSION_MISMATCH` for a refresh/reconnect that
proves a different browser Project. All use the existing redacted diagnostic
envelope; claims, bearer values, raw bytes and rejected payload content never
appear in an error or event.

## Acceptance flows

```text
Build hierarchy:
snapshot -> dry-run project transact -> commit -> snapshot -> render

Export:
snapshot revision -> File Resource project/visual download
-> hash/media/revision verify

Import:
File Resource stage -> candidate evidence -> human approval -> new claim -> snapshot

Human review:
snapshot -> semantic transact intent -> editor highlights/fits -> render/snapshot

Recovery:
claim -> transact(requestId R) -> transport loss -> reconnect
-> result(R) or explicit unavailable result -> snapshot; never blind replay
```

For every flow, the delivery evidence must include:

1. a schema/OpenAPI example exercised through the production parser;
2. browser-host integration proving the shared controller changed (or did not
   change) the same state as a human action;
3. relay boundary tests for scope, expiry, size and redaction where transport
   is involved;
4. a GUI E2E test for the human-visible state, especially import approval,
   session recovery, and semantic highlight;
5. an external client fixture using only the copied claim instruction and the
   deployed OpenAPI—no repository imports, DOM automation or hidden endpoint;
6. explicit assertions that `capabilities` contains neither simulation/PVT/
   waveform kinds nor SPICE/Spectre/design-netlist export or download kinds.

The plan completes only when all five flows work against a deployed browser
session, all current legacy forms have passed M4 migration evidence, and no
excluded capability is exposed.
