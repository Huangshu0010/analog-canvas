# Agent Project Lifecycle and Artifact Completion

Status: `superseded`

Date: `2026-08-13`

Superseded by
[`ADR 0019`](../adr/0019-four-operation-agent-golden-contract.md). The AP2--AP9
operation-expansion sequence below is retained as planning history and is not a
current implementation authority. Current work closes the existing
`capabilities/snapshot/transact/render` contract before any Project lifecycle
surface is reconsidered.

Primary owners: `packages/agent-adapter`, `apps/editor/src/agent`,
`apps/editor/src/document`, `worker`

Related contracts:

- [`agent-api.md`](../specs/agent-api.md)
- [`web-agent-session.md`](../specs/web-agent-session.md)
- [`project-file-format.md`](../specs/project-file-format.md)
- [`persistence-and-recovery.md`](../specs/persistence-and-recovery.md)
- [`export.md`](../specs/export.md)
- [`ADR 0016`](../adr/0016-browser-authoritative-agent-session.md)

## Outcome

An explicitly authorized external Agent can perform every durable project and
document operation required to build, inspect, import, save, reopen, and
visually export a browser-hosted Analog Canvas project without DOM, pointer,
keyboard, filesystem, or screenshot-driven mutation.

The browser remains the Project authority. Human and Agent changes share one
validated transaction, history, recovery, diagnostics, and revision system.
Import remains a staged, user-approved Project replacement. Export produces
bounded formal artifacts and never implies arbitrary filesystem access.

## Scope

This roadmap includes:

- exact Agent read/write symmetry for all persisted fields it may edit;
- symbol/component catalog discovery;
- Project, Document, Port, and hierarchy lifecycle transactions;
- Agent-safe undo/redo and semantic subgraph duplication;
- canonical `.icproj.json` export;
- formal SVG, PNG, and PDF artifact export;
- staged `.icproj.json` and multi-file structural SPICE import;
- explicit browser approval, replacement, recovery, and Agent reauthorization;
- semantic Cell navigation, selection, Net highlight, and viewport control;
- generated schemas, OpenAPI, examples, audit events, and delivery hardening.

This roadmap explicitly excludes:

- simulation, analyses, PVT, waveform data, and measurement APIs;
- SPICE/Spectre/design-netlist export;
- arbitrary filesystem paths or directory access;
- arbitrary source writeback;
- DOM, pointer, keyboard, or screenshot-driven mutation;
- server-side Project persistence, offline Agent edits, CRDT, and multi-user
  collaboration;
- silent authorization transfer to a replacement Project.

## Current baseline and gaps

| Area                 | Current state                                                                | Required completion                                                                                         |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Document editing     | Existing typed Agent `transact` shares the Edit Engine and editor controller | Preserve; do not add a parallel mutation path                                                               |
| Snapshot             | Complete electrical/geometry view of one Document plus a small Project index | Add exact persisted netlist/interface facts, catalog discovery, Project revision, and explicit target modes |
| Project lifecycle    | No Agent create/delete/rename Document, top-Cell, or Project operation       | Add atomic Project transactions and shared history/recovery                                                 |
| Ports                | Agent can place/move an existing Port                                        | Add create/remove/rename/direction/interface-order operations with hierarchy validation                     |
| Hierarchy            | Existing references are readable and some instance netlist data is writable  | Make caller/callee interface updates atomic and validate every affected Document                            |
| History              | Agent `undo`/`redo` edit kinds are rejected                                  | Add actor-safe head-history commands with divergence checks                                                 |
| Duplication          | GUI clipboard has subgraph-copy logic                                        | Move semantic duplication planning below GUI and expose an intent, not OS clipboard                         |
| Project export       | GUI downloads canonical Project JSON                                         | Expose a bounded, scoped canonical Project artifact                                                         |
| Visual export        | Agent renders SVG; GUI additionally exports PNG/PDF                          | Expose all formal visual formats from the same render source                                                |
| Project import       | GUI parses a local Project file and replaces the Project                     | Let Agent stage and validate bytes; require browser approval before replacement                             |
| SPICE import         | GUI consumes a browser `FileList`                                            | Accept a bounded virtual source bundle with an explicit or unambiguous entry                                |
| Save/recovery        | Agent commits update recovery, but no formal Project artifact is produced    | Make commit, recovery, artifact export, and browser download distinct states                                |
| Editor collaboration | Selection, Net highlight, viewport, and active Cell are GUI-local            | Add an optional transient semantic control surface with no Project mutation                                 |
| API compatibility    | v2 freezes four domain operations                                            | Keep v1/v2 unchanged; add the new contract as v3 after ADR/spec approval                                    |

## Architectural boundary

The completed API has three independent authorities:

```text
Persisted circuit/project state
  -> Snapshot + typed Project/Document transaction
  -> validated, revisioned, undoable, recovery-producing

Formal file artifacts
  -> validate import candidate or export artifact
  -> bounded bytes + media type + filename + SHA-256
  -> never accepts a filesystem path

Transient editor collaboration state
  -> active Cell, selection, Net highlight, fitted viewport
  -> semantic ObjectLocator inputs
  -> no Project revision, recovery write, or undo item
```

The relay authenticates and forwards all three surfaces but derives none of
them. The browser host owns current Project bytes, import candidates, editor
state, and every operation result. Import candidate contents are never stored
by the relay.

### Versioning recommendation

Do not silently add operations to API v2, whose accepted contract freezes four
operations. Introduce API v3 while retaining v1/v2 compatibility:

| v3 operation   | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `capabilities` | Versions, scopes, limits, edit/intent catalogs, artifact formats |
| `snapshot`     | Targeted Project, Document, catalog, or editor-state read        |
| `transact`     | Typed `document`, `project`, or `history` transaction            |
| `artifact`     | Project/visual export or import-candidate validation             |
| `render`       | Compatibility-preserving formal/diagnostic SVG review            |
| `collaborate`  | Optional transient Cell/selection/highlight/viewport commands    |

`render` remains separate in v3 so current render clients and review workflows
do not need an unnecessary migration. `artifact` owns portable file products
and import candidates; it does not become another edit engine.

## Core contracts to freeze

### Runtime Project concurrency

Add a browser-session `projectRevision` owned by one new
`EditorProjectController`:

- it starts when a Project becomes active and is not persisted in
  `.icproj.json`;
- every successful Project structural transaction increments it once;
- Document transactions retain their existing Document revision;
- a Project transaction that changes Documents increments the affected
  Document revisions deterministically;
- Project replacement changes `projectSessionId`, terminates the old session,
  and creates a new runtime revision domain;
- requests carry `expectedProjectRevision` and, for multi-Document changes,
  expected revisions for every affected Document.

The Project controller owns atomic application, validation, one history item,
recovery scheduling, resolver refresh, diagnostics, and events. UI handlers and
Agent hosts call it; neither mutates `CircuitProject` directly.

### Project edit inventory

The initial Project edit union must cover:

- `rename_project`;
- `create_document`, `remove_document`, `rename_document`;
- `set_top_document`;
- `create_port`, `remove_port`, `rename_port`, `set_port_direction`;
- `set_port_position` through the same semantic operation used by GUI;
- `set_cell_netlist_interface`, including explicit Port order;
- `set_instance_cell_binding`, including validated caller/callee pin mapping;
- an atomic multi-Document batch for interface changes and caller repairs.

Removal rejects dangling hierarchy references unless the same atomic
transaction repairs them. The last Document cannot be removed. Removing the
top Document requires setting another valid top Document in the same
transaction. Port removal must explicitly remove or remap Net membership,
Routes, NoConnect state, interface order, and caller mappings; it must never
silently leave visual or electrical debris.

### Snapshot read/write symmetry

For every writable persisted field, the v3 Snapshot returns its exact current
value. At minimum it adds:

- Project schema version, source-manifest summary, symbol-library lock, and
  runtime `projectRevision`;
- each Cell's exact netlist name, kind, dialect-relevant binding facts, and
  ordered Port IDs;
- each Instance's exact netlist reference, primitive/subcircuit binding,
  ordered pin mapping, model, and parameters;
- hierarchy edges derived from those exact bindings;
- catalog entries for every insertable product symbol: stable ID, variants,
  pins, roles/directions, default properties, supported parameters, and style
  availability;
- capability/limit information needed before constructing a transaction.

Raw imported source text remains excluded. Optional source spans retain their
separate scope. A parity test must fail when a writable schema field is absent
from the corresponding Snapshot or deterministic returned diff.

### History semantics

Agent history commands are not ordinary schematic edits. The safe default is:

- `undo_own_head(transactionId)` succeeds only when that Agent/session's named
  transaction is the current shared history head;
- `redo_own_head(transactionId)` succeeds only when the matching reverted item
  is the redo head;
- otherwise return `HISTORY_DIVERGED` with current revision/head metadata;
- Agent history never skips over a human or other Agent transaction;
- Project and Document history use the same actor and transaction identity
  rules.

Human Ctrl+Z remains shared-head undo. A broader Agent permission to undo human
work is not part of this roadmap.

### Artifact envelope

Every exported artifact returns:

```typescript
interface AgentArtifact {
  artifactId: string;
  kind: "project" | "svg" | "png" | "pdf";
  mediaType: string;
  filename: string;
  encoding: "base64";
  data: string;
  byteLength: number;
  sha256: string;
  projectSessionId: string;
  projectRevision: number;
  documentId?: string;
  documentRevision?: number;
}
```

Project export uses `serializeProject()` and must be canonical byte-for-byte.
SVG uses the existing formal render. PNG and PDF derive from that same SVG via
the accepted exporter; selection, diagnostics, flightlines, and editor overlays
must never enter a formal artifact.

Artifact responses are bounded by server-advertised byte limits. If inline
delivery proves too large, a later one-time streaming transport may be added,
but it still cannot persist Project content at the relay or expose a path.

### Import candidate envelope

An Agent may submit only bytes, metadata, and a virtual relative path:

```typescript
interface ImportFile {
  path: string; // normalized relative POSIX path
  mediaType: string;
  encoding: "utf8" | "base64";
  data: string;
  byteLength: number;
  sha256: string;
}
```

Two candidate types exist:

- `project`: exactly one `.icproj.json`, parsed, migrated, validated, and
  canonicalized with existing model functions;
- `spice`: a bounded file bundle with an explicit entry path, or `auto` only
  when exactly one valid entry is unambiguous, processed through the existing
  structural SPICE importer.

Validation returns a browser-local opaque `candidateId`, expiry, source hashes,
Project summary, Document/hierarchy summary, diagnostics, migrations applied,
and replacement consequences. It does not mutate Project, history, recovery,
selection, or session identity.

Reject absolute paths, traversal, duplicate case-insensitive paths, symlinks,
unsupported encodings, inconsistent size/hash, include escape, excessive
files/bytes/depth, ambiguous entry files, invalid future schemas, and source
bundles requiring unavailable external content.

### User approval and replacement

The editor shows a persistent pending-import panel containing the candidate
source, hashes, summary, diagnostics, expiry, requesting Agent, and three
actions:

1. **Cancel**: delete the in-memory candidate and notify the Agent.
2. **Open and disconnect**: replace Project and revoke the old session.
3. **Open and reconnect Agent**: replace Project, revoke the old session, and
   issue a new one-time claim with the user-confirmed scopes and Document set.

The third action is explicit new authorization, not token transfer. The old
bearer token never gains access to the replacement Project. The Agent receives
only a terminal replacement event and, when explicitly authorized, a bounded
continuation claim. Reusing the old `requestId` cannot reapply replacement.

Before replacement, cancel pending recovery writes for the outgoing Project.
The imported Project is validated again immediately before activation. After
activation, stage its own recovery state according to the existing recovery
contract; do not mark it as a formal save.

### Transient collaboration contract

The optional `collaborate` operation accepts semantic commands only:

- `navigate_document(documentId)`;
- `set_selection(ObjectLocator[])` and `clear_selection`;
- `highlight_net(ObjectLocator)` and `clear_highlight`;
- `fit_objects(ObjectLocator[])`, `fit_bounds(Rect)`, and `fit_document`.

It validates all locators against the canonical Project Object Index and uses
the same Net trace/highlight read model as GUI. It cannot send pointer events,
keystrokes, arbitrary zoom matrices, CSS, selectors, or DOM queries. It
requires `editor.collaborate`, produces audit/events, and never changes Project
revision, topology hash, history, recovery, or formal export.

## Permission scopes

Retain existing scopes and add only orthogonal scopes:

| Scope                  | Grants                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `project.snapshot`     | Project structure, exact interfaces, source-manifest summary   |
| `project.edit`         | Project/Document/Port/hierarchy structural transactions        |
| `project.export`       | Canonical `.icproj.json` artifact                              |
| `visual.export`        | Formal SVG/PNG/PDF artifacts                                   |
| `project.import.stage` | Upload and validate an import candidate, not replace Project   |
| `history.own`          | Undo/redo only the requesting Agent's current head transaction |
| `editor.collaborate`   | Cell navigation, selection, highlight, and viewport fitting    |

No scope grants filesystem access. Import replacement is always a browser-owner
approval action and is not representable by an Agent bearer scope.

## Work packages

Each work package requires its own `plan/<date-target>/plan.md`, bounded commit,
focused tests, and review. Do not mark a package complete when only its schema
or additive foundation exists.

### WP-AP0 - Contract, ADR amendment, and characterization

Goal: freeze API v3, authority, scopes, import state machine, Project revision,
history rules, limits, errors, compatibility, and threat model before runtime
changes.

Owned areas:

- ADR amendment or a new accepted ADR;
- Agent API, web-session, persistence, Project-file, export, and editor
  interaction specs;
- current behavior characterization tests where needed.

Required decisions and errors:

- exact request/response discriminants and v2 compatibility;
- `STALE_PROJECT_REVISION`, `HISTORY_DIVERGED`, `IMPORT_REQUIRES_APPROVAL`,
  `IMPORT_CANDIDATE_EXPIRED`, `IMPORT_AMBIGUOUS_ENTRY`,
  `ARTIFACT_TOO_LARGE`, and `OBJECT_NOT_FOUND`;
- file count, total bytes, per-file bytes, include depth, candidate TTL, and
  artifact result limits;
- relay payload visibility and no-persistence assertions.

Validation: schema examples, state-machine review, threat table, reference
check, generated-contract delta review.

Exit gate: no implementation package has an unresolved authority, retry,
replacement, history, scope, or compatibility decision.

### WP-AP1 - Exact Snapshot and component catalog

Goal: make every currently writable persisted field readable and give Agents a
machine-readable inventory of insertable product symbols.

Main modules: model projection helpers, `packages/agent-adapter`, symbol product
catalog, generated schemas/OpenAPI.

Work:

- add v3 Project/Document/catalog Snapshot targets;
- surface exact Cell and Instance netlist/interface facts without raw source;
- add Project runtime identity/revision fields supplied by the host;
- publish catalog IDs, variants, pins, parameters, and defaults from the same
  source used by the GUI palette;
- add schema-to-Snapshot write/read parity tests.

Validation: focused adapter/symbol tests, canonical ordering tests, 100/500
instance size measurements, generated artifact check.

Exit gate: an external client can construct every currently accepted Document
edit without repository imports or guessed symbol IDs and can verify the exact
persisted result afterward.

### WP-AP2 - Unified Project controller and transactions

Goal: establish one atomic browser mutation boundary for Project structural and
multi-Document operations.

Main modules: new editor Project controller/history, model/Edit Engine Project
transaction executor, diagnostics, recovery scheduler, Agent host.

Work:

- implement runtime `projectRevision` and composite expected revisions;
- implement the Project edit inventory;
- validate the entire candidate Project once after the atomic batch;
- make one Project transaction one history item and one recovery schedule;
- update resolver, active Document, selection pruning, diagnostics, and events
  from the committed result;
- migrate existing GUI Project/Port/hierarchy handlers to this controller;
- expose the same transaction through Agent v3.

Validation: atomic rollback, stale Project/Document revision, last/top Document
guards, dangling hierarchy rejection, caller/callee interface repair, undo,
recovery coalescing, GUI/Agent parity.

Exit gate: no GUI or Agent handler directly replaces or structurally mutates a
live Project outside replacement/import or the Project controller.

### WP-AP3 - Agent history and semantic duplication

Goal: close common editing parity gaps without exposing OS clipboard or unsafe
shared-history traversal.

Main modules: Project/Document history, clipboard subgraph planner moved to a
shared non-React boundary, Agent transaction schemas.

Work:

- implement `undo_own_head` and `redo_own_head`;
- return current head identity on divergence;
- extract GUI copy/paste electrical closure and ID remapping as
  `proposeDuplicateSubgraph`;
- expose `duplicate_subgraph` with translation/placement intent;
- keep raw clipboard bytes and browser clipboard permissions GUI-only;
- inventory remaining GUI semantic commands and either map each to an existing
  typed edit/intent or explicitly classify it as transient/local-only.

Validation: human interleaving, stale/diverged history, exactly-once retry,
Routes/Junctions/NoConnect/drafting anchor remap, GUI/Agent parity.

Exit gate: Agent can safely reverse its current transaction and duplicate a
connected selection with the same closure as GUI.

### WP-AP4 - Formal Project and visual export artifacts

Goal: expose portable Project JSON and all accepted formal visual formats.

Main modules: model serializer, formal renderer/exporters, Agent adapter,
browser host, relay limits.

Work:

- add scoped canonical Project export;
- reuse v2 render for SVG and add SVG/PNG/PDF artifact requests in v3;
- bind artifacts to Project/Document identity and revision;
- add deterministic filename normalization, media type, size, and SHA-256;
- optionally request a browser download as a visible side effect without
  treating it as persistence authority;
- ensure exports never include diagnostic/editor overlays.

Validation: save-load-save byte equality, SVG equality with direct render, PNG
signature/dimensions, PDF page/bounds reopening, stale revision, byte limit,
permission denial, relay no-store assertions.

Exit gate: Agent can retrieve a formal `.icproj.json`, SVG, PNG, or PDF artifact
using only the public API and prove exactly which revision produced it.

### WP-AP5 - Staged Project and SPICE import

Goal: let Agent supply bounded source bytes and receive the same validated
candidate the GUI importer would produce, with no immediate mutation.

Main modules: browser-safe import service below GUI, model parser/migrations,
SPICE importer, include resolver, Agent artifact handler.

Work:

- extract browser `FileList` adaptation from canonical import logic;
- implement virtual bundle normalization and bounds;
- validate/canonicalize Project candidates;
- parse/import SPICE candidates with explicit entry selection;
- store candidates only in browser memory with TTL and session/request owner;
- return deterministic preview summaries, hashes, diagnostics, and migration
  evidence;
- make GUI Open/Import call the same candidate validation service before its
  existing confirmation/replacement path.

Validation: GUI/Agent candidate equality, migration fixtures, multi-file
includes, path traversal/case collision, ambiguous entry, missing include,
future schema, corrupt bytes, size/depth limits, browser refresh expiry.

Exit gate: identical source bytes produce the same candidate Project and
diagnostics through GUI and Agent, while the active Project remains unchanged.

### WP-AP6 - Approval, replacement, recovery, and reauthorization

Goal: complete the import lifecycle without weakening Project-bound
authorization.

Main modules: Connect Agent/import UI, Agent session hook, Project replacement
controller, recovery scheduler, Worker events/control.

Work:

- add the pending-import review panel and three user decisions;
- revalidate immediately before activation;
- cancel outgoing recovery work, replace once, emit terminal replacement, and
  revoke the old token;
- implement explicit optional continuation claim with confirmed scopes and new
  Document IDs;
- make retry, timeout, offline editor, late response, expiry, cancel, and page
  refresh terminal and deterministic;
- audit without logging Project/source bytes or secrets.

Validation: Playwright Project and SPICE approval flows, cancel, expiry,
offline/reconnect, duplicate request, replacement exactly once, old-token
denial, continuation claim isolation, recovery restoration.

Exit gate: Agent-initiated import cannot alter Project without a visible user
decision, and no credential crosses Project identity silently.

### WP-AP7 - Semantic editor collaboration controls

Goal: let an authorized Agent direct human attention without UI automation.

Main modules: editor state controller, Project Object Index, Net trace/highlight
read model, Agent browser host and schemas.

Work:

- implement the bounded `collaborate` command inventory;
- use the single ObjectLocator and canonical Net trace/highlight APIs;
- prune selection/highlight after edits and Project navigation;
- report resulting active Document, normalized selection, highlight, and
  viewBox;
- add visible audit entries and a user toggle to disable collaboration control
  without revoking circuit read/edit scopes.

Validation: invalid/stale locators, cross-Cell navigation, whole-Net highlight,
fit bounds, no Project/history/recovery change, permission isolation,
human/Agent last-command behavior.

Exit gate: Agent can make its semantic result visible for human review without
DOM selectors, screenshots, pointer input, or persisted presentation changes.

### WP-AP8 - Public contract, client, and parity inventory

Goal: make the completed surface discoverable and straightforward for an
external Agent that knows only the claim instruction and OpenAPI URL.

Main modules: generated JSON Schema/OpenAPI, Agent docs/examples, optional small
TypeScript client, external-process fixtures.

Work:

- publish v3 operations/scopes/limits/error catalog and retain v1/v2 schemas;
- use `$defs/$ref` generation to avoid repeated Project/RichText/edit schemas
  without changing wire JSON;
- provide claim, Snapshot, Project transaction, export, staged import,
  approval wait, reconnect, history, and collaboration examples;
- generate a capability parity test from the actual edit/intent/artifact
  registries;
- state which GUI commands are semantic API operations and which remain local
  gestures.

Validation: generated-artifact check, OpenAPI reference resolution, external
client running without repository imports, compatibility fixtures.

Exit gate: a generic OpenAPI-capable Agent can discover and execute every
in-scope workflow without reading product source.

### WP-AP9 - Security, performance, and delivery hardening

Goal: deliver the completed takeover surface without weakening the existing
mainline gate.

Validation matrix:

| Boundary         | Required evidence                                                            |
| ---------------- | ---------------------------------------------------------------------------- |
| Model            | Project transaction validity, migration, canonical serialization             |
| Mutation         | GUI/Agent parity, atomic rollback, history, recovery, revisions              |
| Import           | malicious paths, bundles, hashes, limits, candidate expiry, approval         |
| Export           | deterministic bytes/hash/revision, overlay exclusion, size limits            |
| Session          | scopes, pause/revoke/expiry, retry, offline, replacement isolation           |
| UI collaboration | locator validation and zero persisted side effects                           |
| Scale            | 100/500-instance Snapshot, Project transaction, import, and export budgets   |
| Product          | deployed external-Agent end-to-end scenarios below                           |
| Delivery         | frozen install, `pnpm ci:check`, review branch, required remote green checks |

Exit gate: all scenarios pass on a deployed review environment, no Project or
import bytes remain in the relay after request completion, and required GitHub
checks are green.

## End-to-end acceptance scenarios

### Build and export a hierarchical Project

```text
User grants Project edit + Project export
-> Agent reads Project, Document, and component catalog Snapshots
-> creates a child Cell and Ports
-> creates a parent instance with validated pin mapping
-> edits both Documents atomically
-> reads exact bindings and interface order back
-> exports canonical .icproj.json at the reported Project revision
-> reopening the artifact produces byte-stable canonical serialization
```

### Stage and approve a Project file

```text
Agent uploads one bounded .icproj.json candidate
-> browser parses, migrates, validates, and returns hash/summary/diagnostics
-> active Project and recovery remain unchanged
-> user chooses Open and reconnect Agent
-> browser revalidates, replaces once, revokes old token
-> new one-time claim contains the replacement Project identity/Document IDs
-> old token cannot Snapshot or edit the new Project
```

### Stage and approve structural SPICE

```text
Agent uploads entry.cir plus local include/model files with hashes
-> virtual include resolver rejects escape and resolves the bounded bundle
-> browser returns the same candidate Project as GUI Import SPICE
-> user approves
-> replacement and reauthorization follow the Project-file state machine
```

### Export formal visuals

```text
Agent commits Document revision N
-> requests SVG, PNG, and PDF for N
-> all artifacts share the same formal scene and page bounds
-> hashes/media/size/revision are reported
-> none contains selection, diagnostics, flightlines, or editor overlays
```

### Safe history under concurrent human work

```text
Agent commits transaction A
-> human commits transaction H
-> Agent requests undo_own_head(A)
-> receives HISTORY_DIVERGED; neither A nor H changes
-> after human undoes H, Agent may undo A only with current head/revision evidence
```

### Direct human review

```text
Agent highlights one Net and fits its hierarchy path
-> editor navigates and highlights through canonical ObjectLocator/Net trace
-> Project revision, topology hash, recovery, and formal export remain unchanged
```

## Delivery order and dependency graph

```text
AP0 contract freeze
  -> AP1 exact reads/catalog
  -> AP2 Project controller/transactions
       -> AP3 history/duplication
       -> AP4 export artifacts
       -> AP5 import candidates
            -> AP6 approval/replacement/reauthorization
  -> AP7 collaboration controls
  -> AP8 public contract/client/parity
  -> AP9 delivery hardening
```

AP4 and AP5 may proceed in parallel after AP2 stabilizes the browser Project
authority. AP7 may proceed after AP1 if it does not touch Project mutation.
Generated artifacts change only in the work package that changes source
schemas; consumers must not hand-edit generated files.

## Completion definition

This roadmap is complete only when:

- Agent-readable state is exact and symmetric with every in-scope write;
- all persisted Project/Document changes enter one validated controller and
  shared history/recovery lifecycle;
- Agent can create and maintain Project, Document, Port, and hierarchy state;
- Agent can safely undo its current head transaction and duplicate a connected
  subgraph through shared planners;
- Agent can retrieve canonical Project and SVG/PNG/PDF artifacts;
- Project/SPICE import is byte-bounded, deterministic, staged, and visibly
  approved before replacement;
- replacement revokes the old token and any continuation is explicit new
  authorization;
- semantic collaboration controls have zero persisted side effects;
- v1/v2 remain compatible, v3 artifacts and examples are generated and tested;
- simulation/PVT/waveform and design-netlist export remain absent by design;
- canonical local and required remote delivery gates are green.
