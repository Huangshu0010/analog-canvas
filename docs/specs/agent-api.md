# Agent Circuit API

Status: `accepted`

Version: `2.1`

Owning phase: `Phase 6/8/9`

Primary owner: `packages/agent-adapter`

Related ADRs: [`0005-agent-api-without-mcp.md`](../adr/0005-agent-api-without-mcp.md),
[`0007-snapshot-driven-agent-workflow.md`](../adr/0007-snapshot-driven-agent-workflow.md),
[`0013-project-connectivity-index.md`](../adr/0013-project-connectivity-index.md),
[`0014-resolved-route-geometry.md`](../adr/0014-resolved-route-geometry.md),
[`0015-object-locator-and-diagnostic-envelope.md`](../adr/0015-object-locator-and-diagnostic-envelope.md).
Snapshot connectivity and resolved-route-geometry fields, and any diagnostic
additions, are added additively (WP-R7/R10); existing Agent clients keep working
without writing the new fields.

## Purpose

Expose a complete read-only circuit view, typed atomic edits, and visual review
to authorized Agents without exposing storage internals or creating a mutation
path beside the Edit Engine.

## Consumers

- embedded Agent hosts and `circuit-layout` Skill
- optional authenticated desktop loopback adapter
- Agent examples/evaluation tools
- GUI/Agent parity and Snapshot consistency tests

## Terminology

| Term              | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| Project Index     | Small list of Documents and instance-reference edges                     |
| Document Snapshot | Complete derived, read-only electrical/presentation view of one Document |
| Snapshot refresh  | Re-read after switch, stale/external change, or global review            |
| Artifact          | Bounded base64 SVG with media type, hash, and byte length                |
| Legacy query      | API v1 bounded descriptor read path retained only for compatibility      |

## Versioned operation envelope

Every request contains a stable `requestId`, an `apiVersion`, and one operation.

API v2 has exactly four operations:

| Operation      | Required payload                                      | Result                                    |
| -------------- | ----------------------------------------------------- | ----------------------------------------- |
| `capabilities` | none                                                  | operations, permissions, limits, versions |
| `snapshot`     | Document ID, optional source spans                    | complete AgentSessionSnapshot             |
| `transact`     | Document ID, revision, transaction ID, typed edits    | applied/dry-run diff and diagnostics      |
| `render`       | Document ID, formal/diagnostics mode, optional bounds | bounded SVG artifact and diagnostics      |

API v1 remains accepted with `capabilities/query/transact/render`. No new query
planner or semantic scope is added to v1. `transact` and `render` retain their
meaning across both versions.

No request accepts Project JSON, a whole Snapshot/Document replacement,
filesystem path, JavaScript, or SVG input.

## Snapshot contract

The response contains:

```typescript
interface AgentSessionSnapshot {
  snapshotVersion: "1.0";
  electricalTopologyHash: string; // lowercase SHA-256, electrical facts only
  byteLength: number;
  project: {
    id: string;
    name: string;
    topDocumentId: string;
    documents: AgentProjectDocument[];
  };
  document: AgentDocumentSnapshot;
}
```

`AgentProjectDocument` contains `id`, `name`, `instanceCount`, and sorted
instance-reference edges. Each edge contains the owning `instanceId`, parsed
target cell/subcircuit name when available, and resolved `targetDocumentId` or
`null`.

`AgentDocumentSnapshot` contains:

- `id`, `name`, `revision`, `sourceStatus`, optional `sourceBinding`, `bounds`,
  and complete `presentation`;
- ports with direction, position, and owning `netId | null`;
- instances with display/source name, symbol/variant, target/model description,
  complete primitive properties and parameters, placement, bounds, complete
  resolved/connected pin inventory, and effective MOS bulk status/Net when
  applicable;
- every pin's name, role/direction when resolvable, local/page position,
  visibility, and `netId | null`;
- Nets with scope, complete terminal refs, port IDs, route IDs, and Junction IDs;
- complete Route endpoints, waypoints, segment modes, optional presentation
  (`wire`/`bulk-dashed`), and derived polyline;
- Junctions, annotations, layout groups, and constraints with all persisted
  fields and members;
- drafting objects with canonical RichText AST, resolved anchor, bounds,
  `locked`, and `zIndex`, plus any invalid-anchor diagnostics;
- spatial diagnostics valid for the returned revision.

The Text & Peripheral Editing System (ADR 0010) extends the Snapshot with the
drafting layer. `annotations` reports the narrowed SchematicAnnotation set;
`drafting.objects` reports exportable `DraftObject`s with their canonical
RichText AST and resolved `VisualAnchor`. An Agent may request "create a
Razavi-style current arrow attached to Route X at 60% of segment 2", but
`transact` still accepts only the typed edit union — never raw paths, SVG,
CSS, HTML, arbitrary LaTeX, or a whole Document. Drafting objects are
non-electrical: they never affect `electricalTopologyHash`, Net membership, or
flightline.

Resolved drafting geometry (position, rotation, endpoints, bounds, and anchor
diagnostics) is derived at Snapshot time from the single
`resolveDraftingObjectGeometry` entry in `@icm/derived`; it is never persisted
and never mixed into the DraftingObject schema. The resolved-geometry fields
in the drafting response are implemented by WP-R4 of the Drafting Runtime
Completion work; until then the response carries raw drafting objects only.

Instance-pin `netId` and Net `terminals` are bidirectional views of one validated
Document and must agree. Arrays use deterministic ID/order rules defined by the
generated schema tests. `electricalTopologyHash` covers only electrical facts
(instances and pin inventory, ports, Nets and their terminal/port membership,
hierarchical instance-reference edges); it excludes placement/rotation/mirror,
Route geometry, Junction placement, annotations, drafting objects, and
diagnostics. It is the migration-identity hash: a schema-1 Project's
`electricalTopologyHash` equals its migrated schema-2 form's.

Snapshot is derived and never persisted by default. It cannot be supplied to
`transact`, save, import, or recovery.

## Snapshot size and permissions

- Snapshot permission defaults to the existing read/query permission for
  compatibility but is reported explicitly by v2 capabilities.
- Source spans require the existing separate permission and explicit request.
- Raw source text is never included.
- `maxSnapshotBytes` is server-owned and reported by capabilities.
- Exceeding it returns `SNAPSHOT_TOO_LARGE` with no partial semantic Snapshot.
- Complete Document delivery is required through the measured 500-instance
  baseline. Future deterministic transport chunking must reconstruct the same
  complete Snapshot and requires a compatible spec revision.

## Legacy v1 query

Version 1 retains these scopes unchanged: `summary`, `selection`, `objects`,
`region`, `net`, `constraints`, `diagnostics`, and `changes`. Count/text budgets,
source permission, truncation, and descriptors retain their accepted behavior.
The Phase 9 Skill does not use this path.

## Transaction semantics

The adapter creates `{ kind: "agent", id: configuredAgentId }` and calls the
shared Edit Engine. `expectedRevision`, dry run, limits, atomicity, locks, and
complete Document validation retain their meaning. A successful non-dry
transaction commits only the validated returned Document and reports a diff;
it never returns or accepts a whole writable Document.

Capability edit kinds are the shared Edit Engine schemas. Phase 9 adds generic
symbol/port edits only through that shared boundary; GUI and Agent must validate
identically.

MOS bulk authoring uses the same typed boundary: `set_mos_bulk_defaults`
configures Cell-level stable Net IDs, `reconcile_mos_bulk` materializes the
effective default/fallback, and an explicit dashed body connection is still a
normal Route plus terminal/Net edits. There is no Agent-only bulk protocol.

`patch_instance_properties` is the single typed property edit. It accepts an
instance ID plus a primitive `set` record and/or an `unset` key list, rejects an
empty or self-conflicting patch atomically, and reports the instance in the
resulting diff. The API does not grow per-field operations such as `set_value`
or `set_w`. A property-only edit follows the existing non-connectivity
source-status convention: an imported `in-sync` Document becomes
`geometry-only-changed`; its original SPICE source facts remain present.

`set_instance_symbol` accepts an explicit source-to-target `pinMap` when names
differ and rejects missing, duplicate, or unknown target pins atomically.
`place_port` and `move_port` expose Port geometry without changing its Net.

On `STALE_REVISION`, the Agent refreshes Snapshot and re-evaluates. It must not
blindly replay the old transaction. A successful local edit does not require an
immediate full refresh when the Agent can safely track the returned diff.

A successful `transact` response may include `resolvedRoutes`: the post-edit
resolved polyline for each Route whose ID is in `diff.changedObjectIds`. This
surfaces the actual stored geometry, including any normalization the Edit
Engine applied (for example `set_route_points` collapsing collinear
waypoints), so an Agent learns the real polyline without an immediate
`snapshot`. When absent or empty, no touched Route has a resolvable polyline.
The field is derived from the validated Document and never carries electrical
or persisted intent beyond what `diff` already reports.

## Diagnostics and render

Diagnostics returned by Snapshot, transact, and render contain:

- stable `code`, `severity`, and human message;
- optional policy metadata: `category` (`structural` or `observation`),
  `confidence`, and `gateEligible`;
- `revision`;
- related `objectIds`;
- optional `path`, `bounds`, or `point`;
- primitive typed `parameters` for machine repair decisions.

All diagnostics produced by `diagnoseVisualQuality` include the policy
metadata. Other API/runtime diagnostics may omit it. Clients must never promote
`gateEligible: false` observations into automatic repair or completion gates;
they require inspection of the formal render.

A `transact` rejection localizes each runtime failure: its diagnostic `path`
points at the failing edit position (`["edits", index]`) or, for a Route
geometry failure, at the Route (`["routes", routeId]`), and `objectIds` names
the offending Route or instance. An Agent must read `path`/`objectIds` to
pinpoint the failing edit rather than parse the message string.

`formal` renders the same export-safe SVG used by the GUI. `diagnostics` may
add a separate overlay group. Render data is base64 encoded and rejected above
`maxRenderBytes`; diagnostic overlays never persist or enter formal export.

## Loopback transport

The optional adapter accepts JSON only, uses `Cache-Control: no-store`, requires
a bearer token of at least 32 characters, and binds only to `127.0.0.1` or
`::1`. It serves `/v1/circuit` for legacy requests and `/v2/circuit` for v2;
the body version must match the path. Request bodies remain bounded and no
filesystem route exists.

## Invariants

- API v2 publishes exactly `capabilities/snapshot/transact/render`.
- API v1 publishes exactly `capabilities/query/transact/render`.
- Every non-capabilities operation explicitly targets a Document ID.
- Snapshot is complete, deterministic, read-only, and revision identified.
- Bidirectional pin/Net views agree.
- An Agent cannot claim human identity or bypass Edit Engine atomicity/locks.
- Raw Project/Snapshot replacement and arbitrary filesystem access do not exist.
- Drafting and guide edits are non-electrical; they never change
  `electricalTopologyHash`, Net/Route/Junction membership, or flightline.
- No request accepts SVG, CSS, HTML, arbitrary LaTeX, or a script/path payload;
  rich text is submitted only as the canonical RichText AST.
- Transport and domain errors use deterministic typed codes.

## Valid example

At task start the host injects a revision-42 Snapshot. The Agent dry-runs and
commits typed moves/routes, receives revision 43 and changed IDs, requests a
diagnostics render, then refreshes Snapshot before final global review.

## Rejected example

A caller posts the returned Snapshot as a mutation or save payload. Request
schema validation rejects it. A transaction based on revision 42 after a human
commit returns `STALE_REVISION`; the Skill refreshes revision 43 rather than
replaying blindly.

## Compatibility and migration

- v1 remains supported during Phase 9 and is covered by its existing fixtures.
- v2 introduces the Snapshot read path and `/v2/circuit` without changing
  persisted Projects.
- Removing v1, changing Snapshot required fields, permission meaning, hash
  coverage, or typed edit semantics requires a compatible version decision.
- Additive diagnostic parameters may appear when clients can ignore them.

## Deterministic validation

- v1/v2 request/response JSON Schema and OpenAPI artifacts
- stable v1 and v2 capabilities snapshots
- complete Snapshot fixture and rejected whole-Snapshot mutation
- bidirectional topology, stable ordering/hash, permission, and byte-limit tests
- 100/500-instance payload/token/generation budgets
- dry-run, stale revision, atomicity, lock, and GUI/Edit Engine parity tests
- spatial diagnostic and formal/overlay artifact inspection
- authenticated `/v1/circuit` and `/v2/circuit` tests

## Open decisions

- v1 removal is deferred until compatibility usage is measured and a later ADR
  accepts deprecation.
- Deterministic transport chunks remain deferred until a real Document exceeds
  the accepted Snapshot budget.
