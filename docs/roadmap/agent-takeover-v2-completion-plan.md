# Four-Operation Agent Takeover Completion

Status: `proposed`

Date: `2026-08-13`

Primary owners: `packages/model`, `packages/edit-engine`,
`packages/agent-adapter`, `apps/editor/src/agent`, `worker`

Related authorities: [`ADR 0019`](../adr/0019-four-operation-agent-golden-contract.md),
[`agent-api`](../specs/agent-api.md),
[`web Agent session`](../specs/web-agent-session.md),
[`project file`](../specs/project-file-format.md), and
[`formal export`](../specs/export.md).

## Outcome

An authorized external Agent can create, inspect, revise, import, save, and
formally review a browser-hosted circuit Project without DOM automation,
pointer/keyboard synthesis, repository access, MCP, simulation, PVT, waveform
data, or SPICE/design-netlist export.

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

## Current gaps and dependency order

| Order | Gap | Single authority to establish | Why it comes first |
| --- | --- | --- | --- |
| M0 | Power identity | `Net.powerDomain` | Completed in schema v5; removes VDD/ground symbol inference. |
| M1 | Port presentation | first-class `Port.presentation`/visual state | Removes duplicate `Port` versus `port`/`port-filled` authority. |
| M2 | Text and attachment | required RichText AST plus one `VisualAnchor` | Removes string fallback and dual `anchor`/`routeAttachment` placement. |
| M3 | Netlist facts | typed `Document`/`Instance.netlist` only | Removes `spice.*` runtime fallback and makes Agent read/write parity provable. |
| M4 | Compatibility corpus | versioned migrations and fixture rewrite | Allows deleting retired visual/compatibility inputs without changing old projects silently. |
| A1 | Project lifecycle | one Project controller and composite revision | Prevents GUI and Agent structural mutation paths from diverging. |
| A2 | Files | scoped browser File Resource | Keeps binary/file handling out of Circuit transactions. |
| A3 | Interaction | shared semantic controller | Keeps selection/highlight/navigation out of persisted circuit state. |

Each M target is a separate schema migration and must complete before a new
Agent write relies on it. Existing legacy forms remain read-only compatibility
until their migration has passed fixtures and real Project samples.

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

### A1 — Project lifecycle under `snapshot` and `transact`

Amend ADR 0019 before implementation. Add a browser-owned
`EditorProjectController` with `projectRevision`, project session identity,
atomic multi-Document validation, one history item, one recovery schedule, and
deterministic selection/active-Document pruning.

`transact` gains typed project edits—not another operation—for project/document
create, rename, remove, top-document selection, Port lifecycle, ordered cell
interfaces, and hierarchy binding/repair. A request carries the Project
revision plus every affected Document revision. Deletion rejects dangling
Routes, Nets, NoConnects, interface order, and caller mappings unless the same
atomic request repairs them.

Exit: no GUI or Agent handler structurally mutates a live Project outside this
controller; stale/rollback/hierarchy-repair cases are deterministic.

### A2 — History and semantic duplication

Move connected-subgraph closure, ID remapping, Route/Junction/NoConnect and
RichText-anchor remapping beneath React. Add `undo_own_head` and
`redo_own_head` intents that can act only on the requesting Agent's shared
history head; otherwise return `HISTORY_DIVERGED` with current evidence.

Exit: Agent and GUI duplication produce equivalent connected selections, and
an Agent cannot skip or undo intervening human work.

### A3 — Browser File Resource

This package requires the ADR amendment from A1. Add a separate scoped HTTPS
resource for `project` and `visual` downloads plus staged `project`/structural
SPICE uploads. It accepts only bytes, media type, normalized relative virtual
paths, declared length, and SHA-256; it never accepts a filesystem path.

Download supports canonical `.icproj.json` and formal SVG/PNG/PDF only. Upload
returns a browser-memory candidate ID, hashes, migrations, Project summary, and
diagnostics without mutation. Candidate expiry, file/byte/depth limits,
duplicate/case-collision/traversal rejection, include confinement, and future
schema rejection are mandatory.

Exit: identical bytes through GUI and Agent produce the same candidate; no
relay retains Project/source/artifact payloads after forwarding.

### A4 — Approval, replacement, and reauthorization

The browser presents one pending-import review surface with cancel, open and
disconnect, or open and issue a fresh continuation claim. It revalidates before
activation, cancels outgoing recovery, replaces exactly once, emits a terminal
event, and revokes the old Project-bound token. A replacement never transfers a
bearer to the new Project.

Exit: import cannot mutate active content without a visible human decision;
old tokens are denied after replacement and continuation claims are explicit.

### A5 — Semantic collaboration through `transact`

Add non-persisting intents for active Document navigation, selection, Net
highlight, and fit-to-objects/bounds/document. They validate canonical
`ObjectLocator` and the same Net trace/highlight service as GUI, emit audit/SSE
evidence, require an explicit scope, and do not alter revision, history,
recovery, topology hash, or formal output.

Exit: a human can see exactly what an Agent is referring to without any DOM
automation or accidental circuit mutation.

### A6 — Public contract and delivery hardening

Publish only current v2 Circuit schemas and examples, capability-derived edit
and intent registries, limits, error catalogue, claim/reconnect/file workflows,
and a no-repository external-client fixture. Use `$defs`/`$ref` in generated
OpenAPI only if the wire JSON remains unchanged. Add scale budgets for 100/500
instance Snapshot, Project transaction, import, and export.

Exit: a generic OpenAPI client can discover all in-scope workflows from the
claim instruction; frozen install, `pnpm ci:check`, deployed review E2E, and
required remote checks are green.

## Scopes and terminal errors to freeze in A1

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
`OBJECT_NOT_FOUND`. All use the existing redacted diagnostic envelope.

## Acceptance flows

```text
Build hierarchy:
snapshot -> dry-run project transact -> commit -> snapshot -> render

Export:
snapshot revision -> File Resource download -> hash/media/revision verify

Import:
File Resource stage -> candidate evidence -> human approval -> new claim -> snapshot

Human review:
snapshot -> semantic transact intent -> editor highlights/fits -> render/snapshot
```

The plan completes only when all four flows work against a deployed browser
session with no simulation or netlist-export capability exposed.
