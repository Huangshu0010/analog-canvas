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

| Capability                                                                | Delivery decision | Authority / API shape                                          |
| ------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| Read a complete Document                                                  | Deliver           | `snapshot`                                                     |
| Atomic Document edits and wiring                                          | Deliver           | `transact` through the shared Edit Engine                      |
| Formal visual evidence                                                    | Deliver           | `render` (SVG) and File Resource visual download (SVG/PNG/PDF) |
| Project create/open/save/export                                           | Deliver           | browser-owned Project controller and scoped File Resource      |
| Structural SPICE import                                                   | Deliver           | staged File Resource candidate, then explicit human approval   |
| `.icproj.json` import/export                                              | Deliver           | staged File Resource candidate / canonical Project download    |
| Active Cell, selection, Net highlight, fit view                           | Deliver           | non-persisting semantic intents inside `transact`              |
| Agent own-head undo/redo and semantic duplicate                           | Deliver           | typed `transact` intents and shared history                    |
| Simulation, PVT, analyses, waveform/measurement data                      | Do not deliver    | no scope, endpoint, Snapshot field, or File Resource kind      |
| SPICE/Spectre/design-netlist export                                       | Do not deliver    | no scope, endpoint, download kind, or capability               |
| Arbitrary paths, filesystem enumeration, Project database, DOM automation | Do not deliver    | rejected at the File Resource and session boundary             |

Production v2 has the strict four-operation request parser, revisioned
single-Document Snapshot/transaction/render path, browser claim and relay
transport, formal SVG result, bounded same-Project reconnect, and scoped
non-persisting semantic GUI control. It does **not** provide a complete Project
lifecycle, file candidate workflow, or cross-Document history semantics.
Existing v1/v3 parser/code/spec fragments are compatibility or historical
material, not production capabilities.

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

| Order | Package                 | Single authority to establish                   | Exit gate                                                                                                                                                               |
| ----- | ----------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0    | Power identity          | `Net.powerDomain`                               | Completed in schema v5; no production supply identity is inferred from labels or symbols.                                                                               |
| M1    | Port presentation       | first-class `Port.presentation`                 | Every live Port has one electrical/visual record; no product or Agent port-symbol authoring remains.                                                                    |
| M2    | Text and attachment     | required RichText AST + one `VisualAnchor`      | GUI, Agent, render/export, clipboard and hit-test use no string/markup or `routeAttachment` fallback.                                                                   |
| M3    | Typed netlist facts     | `Document.netlist` / `Instance.netlist`         | Every writable netlist fact is typed, visible in Snapshot, and no runtime `spice.*` fallback is consulted.                                                              |
| M4    | Compatibility corpus    | tested sequential migrations                    | Shipped fixtures and representative projects rewrite to current form with topology and render stability evidence.                                                       |
| A1    | Project controller      | one browser-owned `EditorProjectController`     | **Deferred by product decision.** Cell creation/rename/delete, hierarchy transactions, and Project-level revision/history are not required for the current Agent scope. |
| A2    | Session continuity      | one session state machine                       | Claim, reconnect, refresh, pause, rotate, revoke, replacement and uncertain write states have deterministic outcomes.                                                   |
| A3    | File Resource           | one bounded in-memory candidate/artifact broker | Project/visual bytes flow through declared kinds, hashes and limits, never paths or hidden storage.                                                                     |
| A4    | Semantic collaboration  | one shared editor semantic controller           | Agent navigation/highlight/fit use the same resolved connectivity and locator service as GUI without persistence.                                                       |
| A5    | History and duplication | one project-aware history/closure planner       | Agent own-head undo/redo and duplicate have the same topology-safe semantics as the GUI.                                                                                |
| A6    | Contract hardening      | generated OpenAPI + external-client proof       | All supported flows are discoverable, scoped, load-tested, and deploy-tested; no excluded feature leaks into capabilities.                                              |

Each M target is a separate schema migration and must complete before a new
Agent write relies on it. Existing legacy forms remain read-only compatibility
until their migration has passed fixtures and real Project samples. Each A
target is a separate target plan and cannot be marked complete merely because
its transport/schema scaffolding exists: it must have a consumer path, an error
contract, and the exit evidence stated below.

## Verified baseline and delivery discipline

The roadmap is deliberately not a claim that every listed package already
exists. At the start of the remaining delivery sequence the completed model
authorities are:

| Completed slice | Current authority                                 | What new Agent writes may not do                                  |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| M0              | `Net.powerDomain`                                 | infer a supply from a marker Symbol, label, name, or fixed Net ID |
| M1              | first-class `Port` plus `Port.presentation`       | author `port` or `port-filled` as an electrical Instance          |
| M2              | required RichText AST and required `VisualAnchor` | author a string/markup annotation or `routeAttachment`            |
| M3              | typed `Document.netlist` / `Instance.netlist`     | write or read runtime `spice.*` facts                             |
| M4              | schema-v8 compatibility corpus                    | treat historic input forms as a second current Project contract   |

The current Project schema is v8. These completed migrations remain migration
evidence, not a reason to retain their former runtime fallbacks.

M3 and the first M4 compatibility-corpus gate are complete: structural import,
Snapshot, ERC, hierarchy, search, component parameters, and transaction
validation consume typed netlist facts; current Projects reject `spice.*`
writes. Every shipped Project fixture is classified as current, sequentially
migratable historic input, or explicitly rejected. The next active delivery
slice is A3 File Resource. A1 Cell/hierarchy management is deliberately
deferred; A2 same-Project recovery and A4 semantic editor control are complete
and do not depend on it.

Every remaining row below is its own target plan, commit series, and validation
boundary. No target may claim completion from types or transport scaffolding
alone. It needs: one runtime owner, one human-visible or external-client
consumer, deterministic negative cases, and the stated exit evidence. A
temporary adapter is permitted only at a numbered migration boundary; an Agent
authoring parser never accepts the retired form.

## Detailed implementation sequence

### M3. Typed netlist facts and immutable source provenance

**Purpose.** Make typed model fields the sole runtime source for reference,
binding, parameters, source pin order, hierarchy target, and Cell interface.
This supports structural SPICE _import_ and source-status reporting; it does
not create a design-netlist export feature.

**Schema-v8 decision.** Add exactly the typed facts absent from the current
model before removing a reader:

- `Instance.netlist` gains an ordered terminal mapping, including source
  position and resolved Symbol pin name, so an import preserves pin order
  without `spice.pin.P<n>`.
- a subcircuit binding owns `childDocumentId`; it is the only runtime hierarchy
  edge. A binding cannot be both external and linked to a child Document.
- source-only information that has no editable circuit meaning moves to a
  tagged immutable `importProvenance` record beside the typed facts. It may
  retain a source span, dialect, original target spelling, and bounded opaque
  import attributes. It is never a generic `properties` bag, never used for
  electrical decisions, and never patchable through normal property edits.
- document source identity stays in `source`/`sourceBinding`; the existing
  typed `Document.netlist` continues to own interface name and ordered Port
  IDs. It must reject duplicate, missing, or unordered interface members.

The target first inventories every `spice.*` use and maps it to one of the
fields above. The importer writes only that form. Schema-v7-to-v8 migration
copies recognized legacy facts deterministically, moves unknown source facts to
provenance, rejects contradictory duplicate facts with path diagnostics, then
removes all `spice.*` keys from ordinary editable properties. It never derives
a child Cell by name when an ID is absent.

**Consumer conversion.** Convert Snapshot, hierarchy index/navigation,
ERC, project search, component parameter display, and the Edit Engine's
symbol/pin validation in the same target. Snapshot must expose every editable
typed fact and clearly separate optional provenance from editable data. ERC
and hierarchy validation must consume the typed terminal map and binding,
never reparse source strings. `properties` remains available for non-netlist
user metadata only.

**Evidence.** Test import of primitives, models, external subcircuits and
linked subcircuits; pin-order preservation; missing/unsupported binding;
attempted stale `spice.*` authoring; hierarchy and ERC parity; and one complete
v7-to-v8 save/load/canonical round trip. A source-reference test must prove
that provenance is inspectable but cannot change electrical topology. Run
focused model/import/derived/edit-engine/Agent tests, generated API artifacts,
and `pnpm verify:branch` before delivery.

### M4. Compatibility corpus, retirement, and documentation truth

**Purpose.** Prove that legacy Projects have a single sequential path to the
current authority, then retire runtime compatibility rather than leaving a
second live contract forever.

**Corpus.** Maintain two explicit groups: immutable old-version inputs used
only to test migrations, and current canonical Projects used by GUI/import/
render tests. Include every shipped `.icproj.json` fixture plus representative
structural-SPICE imports, hierarchy, Port, Power, RichText/anchor, NoConnect,
and Razavi visual samples. For each input assert:

1. sequential migration reaches the current schema;
2. canonical save/load is byte stable;
3. electrical topology hash, hierarchy bindings, and ordered terminal facts
   match an approved expectation;
4. formal SVG/PNG/PDF output stays within its approved golden contract; and
5. no current serialized Project contains `spice.*`, a port Symbol instance,
   legacy VDD electrical identity, string annotation fallback, or
   `routeAttachment`.

After that evidence, delete production readers/writers and retired catalog
authoring paths. Keep only migration input fixtures and migration code needed
to open supported historic versions. Historical reference assets may remain
outside the product catalog. In the same delivery, synchronize the current
Project-file, model, Agent API, web-session, user compatibility, and workflow
documents with the actual schema/API version; archive or label non-normative
v1/v3 material so an external Agent cannot mistake it for a supported route.

**Evidence.** A repository-wide production-source absence audit supplements,
but never replaces, corpus tests. The target is blocked if any source Project
cannot migrate without guessing an electrical fact; retain it as a named
unsupported compatibility case instead of silently repairing it.

### A1. Browser-owned Project controller and Project transactions (deferred)

**Purpose.** Replace the current per-Document controller collection with one
`EditorProjectController` that owns the live Project map/order, composite
revision, active Cell pruning, hierarchy validation, composite history, and
recovery scheduling. `DocumentHistory` stays an internal implementation
detail.

Before code, amend ADR 0019 and the Agent/API and web-session specs together
with one unambiguous `transact` target discriminant. The public API remains
four operations. A Document transaction and a Project transaction may not be
two ambiguous root-field conventions; the production parser accepts the one
chosen discriminated shape and the generated OpenAPI shows it. Project edits
cover only create/rename/remove Document, select top Document, update ordered
Cell interfaces, and repair typed hierarchy bindings. They carry expected
Project revision plus every affected Document revision, and are atomic.

Project deletion rejects dangling Routes, Nets, NoConnects, interface members,
and callers unless the same transaction repairs them. GUI, Agent host, file
approval, and recovery call the controller only; none edits `Project.documents`
directly. Tests cover stale Project revision, multi-Document rollback,
active-selection pruning, hierarchy repair, one composite undo item, human /
Agent parity, and rejection before recovery or session events.

### A2. One explicit session state machine

**Purpose.** Replace independent panel/hook/relay interpretations with a
shared state-machine contract for `idle`, `authorizing`, `claimable`,
`claimed`, `online`, `paused`, `reconnecting`, `offline`, `revoked`,
`replaced`, and `expired`.

The browser stores only a bounded same-tab reconnect proof (`sessionId`,
editor secret, and Project-session identity) in `sessionStorage`; it never
stores bearer tokens or Project bytes. The worker owns claim/token expiry,
scope, rate limit, and request-result retention. The host owns live Project
identity and terminal execution evidence. All three use the same transition
table and the same error converter.

Reconnect may reattach only to the same Project session. Open/import/restore,
session expiry, explicit revoke, rotation, and Project mismatch erase recovery
proof and require a new claim. An uncertain write is resolved solely through
the original `requestId`; it is never replayed under a new ID. Add fake-time,
browser-refresh, worker-drop, duplicate-request, rotate/revoke, and secret
redaction tests, then one deployed relay/browser scenario.

### A3. Scoped File Resource and browser-approved import

**Status: complete (2026-08-13).**

**Purpose.** Deliver file capability without exposing a filesystem or adding a
fifth Circuit operation. The File Resource is a separate, browser-owned
OpenAPI resource discovered from `capabilities`; it has only `project`,
`visual`, and staged `project` / `structural-spice` kinds.

Downloads are generated from a named validated Project/Document revision and
return bytes, media type, SHA-256, and byte length. Visual formats are SVG,
PNG, and PDF only. Staging accepts bytes, a normalized relative virtual name,
media type, declared length/hash, and a bounded include graph. It rejects raw
paths, URLs, traversal, duplicate names, hash/length mismatch, unsupported
future schema, excessive nesting, and simulation/model-analysis classes.

Staging does not mutate the Project. The browser alone presents candidate
summary/migrations/diagnostics and chooses Cancel, Open-and-disconnect, or
Open-and-reconnect. Replacement revokes the old session and needs a new claim;
the relay retains no bytes. Required evidence includes byte-identical GUI /
Agent exports, deterministic candidate summaries, every rejection path, no
secret or raw-byte leak, and browser approval E2E.

### A4. Shared semantic editor control

**Status: complete (2026-08-13).**

**Purpose.** Let an Agent make its review visible without coordinate guessing,
DOM automation, or persisted canvas state. Add explicitly non-persisting
`transact` intents for activate Cell, select canonical `ObjectLocator`s,
highlight a resolved Net, fit an entire Document, and clear focus. Selection
and Net highlighting retain the existing GUI point-focus behavior; arbitrary
Agent-provided view bounds are intentionally excluded from this first public
surface.

The intents consume the existing Object Locator, connectivity index, resolved
route geometry, and Net-highlighting service. They return resolved objects and
Net evidence, require `editor.semantic-control`, and never update
Project/Document revision, history, recovery, topology hash, flightline policy,
or formal render. GUI and Agent render the same existing overlay and return
matching errors for stale, inaccessible, or deleted locators. Bind keyboard
shortcuts only in the human UI; the Agent API uses the typed intent, not
simulated keystrokes.

### A5. Project-aware history and connected duplication

**Purpose.** Move semantic closure and identity remapping below React so human
and Agent receive the same behavior. The controller owns one composite history
record per atomic Project transaction. `undo_own_head` / `redo_own_head` can
act only when the requesting Agent owns the current shared history head;
otherwise return `HISTORY_DIVERGED` with current revision/actor evidence.

The duplicate planner takes canonical selected locators and derives a connected
closure. It remaps Instances, Ports, Nets, Routes, Junctions, NoConnects,
typed hierarchy bindings, RichText anchors, layout groups/constraints, and
annotations in a single transaction; it never clones a hidden compatibility
field. Test isolated/closed/branched Routes, hierarchy, anchors, mixed human /
Agent history, stale retries, and equivalence with the GUI duplicate action.

### A6. Public contract hardening and release proof

**Purpose.** Leave one discoverable external interface rather than an
implementation-only capability. Generated OpenAPI publishes only production
v2's four Circuit operations plus declared File Resource paths. It uses
`$defs`/`$ref` only as a generation optimization: the accepted wire JSON and
examples cannot change.

The contract includes schemas for 200, 400, 401, 403, 409, 413, 429, and 503;
a single error-envelope converter with every Zod issue path; examples for
claim, capabilities, Snapshot, dry-run/commit, render, reconnect, and File
Resource flows; capability-derived edit/intent/resource registries; limits,
scopes, and explicit exclusions. Validate every example through the production
parser and use an external-client fixture that has only the copied claim
instruction and deployed OpenAPI—no repository import, SDK, MCP, DOM, or
undocumented endpoint.

The final delivery gate includes frozen install, `pnpm ci:check`, scale budgets
for 100/500-instance Snapshot, Project transaction, staged import, and visual
export, deployed browser/relay E2E, and required remote checks. It must assert
that capabilities expose neither simulation/PVT/waveform data nor SPICE,
Spectre, or design-netlist export/download kinds.

## Dependency gates and completion matrix

| Target | Cannot start before                         | May not leave behind                       | Completion evidence                                           |
| ------ | ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| M3     | M0--M2                                      | any runtime `spice.*` decision             | schema-v8 migration and all typed consumers                   |
| M4     | M3                                          | untested current/legacy dual forms         | corpus migration, canonical/golden proof, docs reconciliation |
| A1     | M4                                          | a second live Project mutation path        | controller-only Project edits and composite rollback          |
| A2     | existing immutable Project-session identity | hook/panel/relay state divergence          | reconnect/terminal-state proof                                |
| A3     | A2 replacement semantics                    | paths, hidden storage, implicit import     | approved candidate/download proof                             |
| A4     | M4 locator/connectivity facts               | coordinate-derived highlight state         | shared overlay and no-persistence proof                       |
| A5     | A1 composite history                        | React-only closure/remapping               | own-head and GUI-parity proof                                 |
| A6     | A1--A5                                      | undocumented or excluded public capability | deployed external-client and CI evidence                      |

No simulation, PVT, waveform/measurement, SPICE/Spectre/design-netlist export,
filesystem path, cloud Project store, or browser-automation work may be added
to any target in this roadmap. A request for one of those capabilities requires
a new product decision, not a convenience extension to the File Resource or
Agent `transact` schema.

## Work packages

### M1 — Port symbol continuity

Ordinary schematic Ports remain the existing `port` and `port-filled` symbol
instances. GUI placement and Agent edits use the standard `add_instance` and
terminal-endpoint contracts. No Port-specific visual model, migration, or
Project-level lifecycle API is in scope.

Exit: catalog, GUI, renderer, export, and Agent Snapshot preserve the ordinary
component/terminal contract without parallel visual Port records.

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

| User-visible need                                      | One implementation owner                                    | Agent-facing evidence / command          | Delivery package   |
| ------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------- | ------------------ |
| Discover allowed work                                  | capability registry derived from schemas and session scopes | `capabilities`                           | A6                 |
| Read circuit, hierarchy and current diagnostics        | Snapshot serializer plus Project header                     | `snapshot`                               | current, M1–M4, A1 |
| Add/move/connect/delete circuit objects                | Edit Engine + routing planner                               | typed `transact` / `wireIntent`          | current, M1–M4     |
| Create/manage Documents and hierarchy                  | `EditorProjectController`                                   | typed Project `transact` edits           | A1                 |
| Inspect final appearance                               | formal renderer/exporters                                   | `render`                                 | current            |
| Save a portable Project                                | canonical project serializer                                | File Resource `project` download         | A3                 |
| Save formal drawing                                    | SVG/PNG/PDF exporters                                       | File Resource `visual` download          | A3                 |
| Import Project or structural SPICE                     | import parser and migration chain                           | File Resource stage + browser approval   | M4, A3             |
| Review an Agent's focus in the canvas                  | editor semantic controller                                  | non-persisting `transact` intent + SSE   | A4                 |
| Undo Agent's latest still-current action               | project-aware history                                       | `undo_own_head` / `redo_own_head` intent | A5                 |
| Keep a granted Agent connected across transient breaks | session state machine                                       | SSE state / same `requestId` result      | A2                 |

The File Resource is discovered through `capabilities` as scoped resource
descriptors, including max bytes, supported media types, candidate lifetime and
the exact upload/download URLs for the current session. It has no generic
`file` RPC, no command string, no raw path argument, and no permanent server
storage. A resource response is always a small descriptor; bytes are carried
only over the declared file transfer request.

## Required implementation targets

Each row is one future target-plan/commit series, not permission to implement
the entire roadmap in one change.

| Target | Main owned paths                                                                 | Required behavior                                                | Must not regress                                                         |
| ------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| M1     | symbol catalog, editor, renderer, Agent Snapshot                                  | ordinary Port symbol/terminal continuity                         | existing Port connectivity, external-port rendering, old Project opening |
| M2     | model annotation/drafting schema, text editor, renderer, clipboard, Agent schema | AST-only RichText and one attachment record                      | existing labels, current arrow and drawing-object positioning            |
| M3     | model/import/netlist facts, ERC, hierarchy, Snapshot                             | typed netlist facts and immutable provenance                     | structural SPICE import, round-trip source-status behavior, pin order    |
| M4     | migrations, fixtures, generated legacy readers                                   | rewrite all supported old data then delete retired runtime forms | topology hash, formal output baseline, explicit source provenance        |
| A1     | project controller, history host, agent host, schema/OpenAPI                     | atomic Project edits and hierarchy repair                        | single-Document GUI/Agent transaction parity, undo, recovery             |
| A2     | relay state, browser session hook/panel, session tests                           | same-Project resume and deterministic terminal states            | single-use claims, scope checks, exact-once request IDs                  |
| A3     | worker file handlers, import/export adapters, GUI approval panel                 | bounded project/visual download and staged import                | no raw paths, no implicit Project replacement, no retained bytes         |
| A4     | locator/connectivity/highlight services and editor shell                         | shared visible Agent focus                                       | no persisted change, no revision/history/recovery impact                 |
| A5     | history, duplicate planner, clipboard integration, Agent adapter                 | safe own-head history and connected duplication                  | human undo order, route/Junction/NoConnect/remapped anchors              |
| A6     | OpenAPI generator, docs, external fixture, CI/deployed E2E                       | public discoverability and production evidence                   | wire JSON, error envelope, excluded-capability absence                   |

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

| Direction    | Kind               | Result                                                    |
| ------------ | ------------------ | --------------------------------------------------------- |
| download     | `project`          | canonical `.icproj.json` for a named Project revision     |
| download     | `visual`           | formal SVG, PNG, or PDF for one Document/revision         |
| stage upload | `project`          | parsed/migrated `.icproj.json` candidate                  |
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
