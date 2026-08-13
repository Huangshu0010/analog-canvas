# ADR 0018: Agent Project Lifecycle, Artifacts, and v3 API

Status: `accepted`

Date: `2026-08-13`

Owners: `apps/editor/src/agent`, `apps/editor/src/document`, `worker`,
`packages/agent-adapter`, `docs/specs/agent-api.md`,
`docs/specs/web-agent-session.md`

## Context

ADR 0016 froze the browser-authoritative Agent session for the v1/v2 Circuit
API. That contract is **Document-scoped**: `transact` carries one
`documentId` and one `expectedRevision`, `snapshot` reads one Document plus a
small Project index, the four v2 operations (`capabilities`/`snapshot`/
`transact`/`render`) are explicitly frozen, and Agent `undo`/`redo` edit kinds
are rejected as `UNSUPPORTED_EDIT`. ADR 0016 also froze Project replacement as a
session-terminal event and left Project/export artifacts, Agent import, Agent
history, and editor collaboration explicitly open.

The remaining browser-Agent takeover surface — building, inspecting, importing,
saving, reopening, and visually exporting a whole Project — therefore needs a
frozen contract before any runtime change. The
[Agent Project lifecycle and artifact completion roadmap](../roadmap/agent-project-lifecycle-and-artifacts-plan.md)
defines work packages AP0–AP9 to deliver it. This ADR is AP0: it freezes the
decisions those packages implement. It deliberately excludes simulation, PVT,
waveforms, design-netlist export, arbitrary filesystem access, DOM/pointer/
keyboard/vision-driven mutation, server-side Project persistence, and silent
authorization transfer.

The ADR lifecycle (`docs/adr/README.md`) treats accepted ADRs as immutable
historical records; a later decision extends an earlier one by linking both
documents rather than rewriting history. This ADR therefore **extends, and does
not modify, ADR 0016**.

## Decision

Freeze the Agent v3 contract as an **additive** version that retains v1/v2
unchanged, organized as three independent authorities that share the
browser-authoritative session and transport of ADR 0016.

### Three authorities

```text
Persisted Project/Document state
  -> Snapshot + typed Project/Document transaction
  -> validated, revisioned, undoable, recovery-producing

Formal file artifacts
  -> validate an import candidate or produce an export artifact
  -> bounded bytes + media type + filename + SHA-256
  -> never accepts a filesystem path

Transient editor collaboration state
  -> active Cell, selection, Net highlight, fitted viewport
  -> semantic ObjectLocator inputs
  -> no Project revision, recovery write, history item, or formal export change
```

The relay authenticates and forwards all three surfaces but derives none of
them. The browser host owns current Project bytes, import candidates, editor
state, and every operation result. Import candidate contents are never stored
by the relay.

### API v3 (additive; v1/v2 frozen)

v3 publishes `capabilities | snapshot | transact | artifact | render |
collaborate`. v1 (`capabilities/query/transact/render`) and v2
(`capabilities/snapshot/transact/render`) remain exactly as frozen in
`agent-api.md`. `render` stays a separate v3 operation so existing render
clients and review workflows need no migration; `artifact` owns portable file
products and import candidates and does not become a second edit engine.

### Runtime Project concurrency

A browser-session `projectRevision`, owned by one `EditorProjectController`
(AP2), is added:

- it starts when a Project becomes active and is **not** persisted in
  `.icproj.json`;
- every successful Project structural transaction increments it once;
- Document transactions retain their existing Document revision;
- a Project transaction that changes Documents increments the affected Document
  revisions deterministically;
- Project replacement changes `projectSessionId`, terminates the old session,
  and creates a new runtime revision domain;
- requests carry `expectedProjectRevision` and, for multi-Document changes,
  expected revisions for every affected Document.

The Project controller owns atomic application, validation, one history item,
recovery scheduling, resolver refresh, diagnostics, and events. UI handlers and
Agent hosts call it; neither mutates `CircuitProject` directly. This generalizes
the ADR 0016 single-`EditorDocumentController.dispatchTransaction()` write path
to Project-structural and multi-Document operations.

### Project edit inventory

The initial Project edit union was proposed to cover `rename_project`;
`create_document`, `remove_document`, `rename_document`; `set_top_document`;
`set_cell_netlist_interface` (including explicit Port order);
`set_instance_cell_binding` (including validated caller/callee pin mapping);
and an atomic multi-Document batch for interface changes and caller repairs.

**Superseded scope note (2026-08-14):** no Port-specific Project lifecycle
operations are adopted. Ordinary visual Ports remain symbol instances and use
the existing Document `add_instance` plus terminal-endpoint edit contract.

Removal rejects dangling hierarchy references unless the same atomic transaction
repairs them. The last Document cannot be removed. Removing the top Document
requires setting another valid top Document in the same transaction.

### History semantics

Agent history commands are not ordinary schematic edits. The safe default is:

- `undo_own_head(transactionId)` succeeds only when that Agent/session's named
  transaction is the current shared history head;
- `redo_own_head(transactionId)` succeeds only when the matching reverted item
  is the redo head;
- otherwise return `HISTORY_DIVERGED` with current revision/head metadata;
- Agent history never skips over a human or other-Agent transaction;
- Project and Document history use the same actor and transaction identity
  rules.

Human Ctrl+Z remains shared-head undo. A broader Agent permission to undo human
work is not part of this contract.

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
the accepted exporter. Selection, diagnostics, flightlines, and editor overlays
must never enter a formal artifact. Artifact responses are bounded by
server-advertised byte limits.

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

Two candidate types exist: `project` (exactly one `.icproj.json`, parsed,
migrated, validated, and canonicalized with existing model functions) and
`spice` (a bounded file bundle with an explicit entry path, or `auto` only when
exactly one valid entry is unambiguous, processed through the existing
structural SPICE importer). Validation returns a browser-local opaque
`candidateId`, expiry, source hashes, Project summary, Document/hierarchy
summary, diagnostics, migrations applied, and replacement consequences. It does
not mutate Project, history, recovery, selection, or session identity.

Reject absolute paths, traversal, duplicate case-insensitive paths, symlinks,
unsupported encodings, inconsistent size/hash, include escape, excessive
files/bytes/depth, ambiguous entry files, invalid future schemas, and source
bundles requiring unavailable external content.

### Import state machine

Import replacement is always a browser-owner approval action and is not
representable by an Agent bearer scope. The editor shows a persistent
pending-import panel with the candidate source, hashes, summary, diagnostics,
expiry, requesting Agent, and three actions:

1. **Cancel** — delete the in-memory candidate and notify the Agent.
2. **Open and disconnect** — replace Project and revoke the old session.
3. **Open and reconnect Agent** — replace Project, revoke the old session, and
   issue a new one-time claim with the user-confirmed scopes and Document set.

The third action is explicit new authorization, not token transfer. The old
bearer token never gains access to the replacement Project. The Agent receives
only a terminal replacement event and, when explicitly authorized, a bounded
continuation claim. Reusing the old `requestId` cannot reapply replacement.
Before replacement, cancel pending recovery writes for the outgoing Project;
revalidate the imported Project immediately before activation; after activation,
stage its own recovery state without marking it a formal save.

### Permission scopes

Retain the ADR 0016 `circuit.*` scopes and add only orthogonal scopes:

| Scope                  | Grants                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `project.snapshot`     | Project structure, exact interfaces, source-manifest summary   |
| `project.edit`         | Project/Document/Port/hierarchy structural transactions        |
| `project.export`       | Canonical `.icproj.json` artifact                              |
| `visual.export`        | Formal SVG/PNG/PDF artifacts                                   |
| `project.import.stage` | Upload and validate an import candidate, not replace Project   |
| `history.own`          | Undo/redo only the requesting Agent's current head transaction |
| `editor.collaborate`   | Cell navigation, selection, highlight, and viewport fitting    |

No scope grants filesystem access or Project replacement.

### Frozen error codes

The accepted domain-code set is the v2 set plus the v3 additions. v3 adds
`STALE_PROJECT_REVISION`, `HISTORY_DIVERGED`, `OBJECT_NOT_FOUND`,
`ARTIFACT_TOO_LARGE`, `IMPORT_REQUIRES_APPROVAL`, `IMPORT_CANDIDATE_EXPIRED`,
and `IMPORT_AMBIGUOUS_ENTRY`. `STALE_PROJECT_REVISION` returns the current
`projectRevision` and is not terminal, mirroring `STALE_REVISION`. Today these
codes are prose-defined; closing the generated `error.code` open string into an
enum is part of the work package that changes source schemas (AP1/AP8), not
this ADR.

### Frozen limits

The v2 capabilities limits are retained. v3 advertises additional ceilings:
import bundle file count, total bytes, per-file bytes, include depth, candidate
TTL, and artifact result byte limit. Exact numeric ceilings are published by the
v3 `capabilities` response when the schemas land (AP1/AP8); this ADR freezes
that they exist and are server-owned.

### Relay no-persistence

The ADR 0016 relay guarantees (no `.icproj` persistence, no edit execution, no
undo ownership, no actor creation) extend to the v3 surfaces: import candidate
bytes and exported artifact bytes transit the relay but are never persisted
there; `Cache-Control: no-store` continues to apply; responses are bounded by
the advertised limits.

## Alternatives considered

### Amend ADR 0016 in place

- Benefits: one document for the whole Agent surface.
- Costs: the ADR lifecycle treats accepted ADRs as immutable; rewriting 0016
  destroys the historical record of what the first release froze.
- Reason not selected: extend by linking (this ADR) instead of rewriting.

### Extend v2 instead of introducing v3

- Benefits: no version surface.
- Costs: `agent-api.md` freezes v2 at exactly four operations; silently adding
  Project/artifact/import/collaboration operations would break that contract and
  every client that reasoned about it.
- Reason not selected: v3 is additive and v1/v2 stay frozen.

### Defer the freeze until implementation

- Benefits: less upfront design.
- Costs: the roadmap's own exit gate requires every implementation package to
  have a resolved authority, retry, replacement, history, scope, and
  compatibility decision; deferring risks inconsistent ad-hoc choices across
  AP1–AP9.
- Reason not selected: freeze decisions first (AP0), then implement.

### Agent-driven import replacement without browser approval

- Benefits: fully autonomous Agent workflows.
- Costs: an Agent would replace a Project the user is editing, revoking their
  authority, with no visible consent; contradicts ADR 0016 Project-binding
  guarantees.
- Reason not selected: import replacement is always a browser-owner approval
  action.

## Consequences

### Positive

- v1/v2 clients and the frozen four-operation contract are untouched.
- Every later work package implements against a single resolved contract.
- The three-authority split keeps persisted mutation, file artifacts, and
  transient collaboration independently testable and securable.
- Browser authority, recovery, history, and the no-persistence relay guarantee
  are preserved and extended, not weakened.

### Negative or limiting

- v3 adds surface (operations, scopes, codes, limits, envelopes, a state
  machine) that the relay and host must enforce and test.
- Agent import cannot complete without a human in the loop; fully autonomous
  Project replacement remains unavailable by design.
- Artifact and candidate sizes are bounded; very large exports may require a
  later streaming transport that still cannot persist at the relay.
- Closing the open-string error code into a schema enum is deferred to AP1/AP8,
  so the generated contract lags this prose freeze until then.

## Compatibility and migration

- No persisted Project or Document format change in AP0. Runtime
  `projectRevision` is session-only and is not written to `.icproj.json`.
- v1/v2 request/response shapes, the v2 Snapshot, typed Document edits,
  permissions, and render contracts are unchanged.
- Generated `fixtures/agent-api/` artifacts are **not** changed by this ADR;
  they change only in the package that changes source schemas (AP1/AP8).
- AP0 adds a characterization test that locks the current v2 boundary so the v3
  delta is visible when later packages land.

## Validation

- spec deltas and the import state-machine review in
  [`../specs/agent-api.md`](../specs/agent-api.md),
  [`../specs/web-agent-session.md`](../specs/web-agent-session.md),
  [`../specs/persistence-and-recovery.md`](../specs/persistence-and-recovery.md),
  [`../specs/project-file-format.md`](../specs/project-file-format.md),
  [`../specs/export.md`](../specs/export.md), and
  [`../specs/editor-interaction.md`](../specs/editor-interaction.md)
- threat-table extension in `web-agent-session.md`
- `pnpm docs:check` and `pnpm references:check` for documentation links
- `packages/agent-adapter/src/contract-characterization.test.ts` locking the
  current v2 boundary
- later packages cite these frozen decisions at their exit gates (AP1–AP9)

## Related documents

- [`0016-browser-authoritative-agent-session.md`](0016-browser-authoritative-agent-session.md)
  (extended, not modified)
- [`0005-agent-api-without-mcp.md`](0005-agent-api-without-mcp.md)
- [`0007-snapshot-driven-agent-workflow.md`](0007-snapshot-driven-agent-workflow.md)
- [`0015-object-locator-and-diagnostic-envelope.md`](0015-object-locator-and-diagnostic-envelope.md)
- [`0017-deterministic-design-netlist-boundary.md`](0017-deterministic-design-netlist-boundary.md)
- [`../specs/agent-api.md`](../specs/agent-api.md)
- [`../specs/web-agent-session.md`](../specs/web-agent-session.md)
- [`../roadmap/agent-project-lifecycle-and-artifacts-plan.md`](../roadmap/agent-project-lifecycle-and-artifacts-plan.md)
