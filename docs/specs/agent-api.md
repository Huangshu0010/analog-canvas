# Agent Circuit API

Status: `accepted`

Version: `1.2`

Owning phase: `Phase 6/8`

Primary owner: `packages/agent-adapter`

Related ADR: [`0005-agent-api-without-mcp.md`](../adr/0005-agent-api-without-mcp.md)

## Purpose

Expose bounded circuit context, typed atomic edits, and local visual review to
authorized Agents without exposing storage internals or creating a mutation
path beside the Edit Engine.

## Consumers

- embedded Agent hosts
- optional desktop loopback adapter
- Agent guidance and examples
- GUI/Agent parity tests

## Terminology

| Term          | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| Service       | Transport-independent handler bound to one live Document store           |
| Scope         | Explicit bounded query selector; there is no implicit whole-Project read |
| Artifact      | Bounded base64 image response with media type, hash, and byte length     |
| Edit category | `geometry`, `connectivity`, or `presentation` permission group           |

## Operation envelope

Every request contains `apiVersion: "1.0"`, a stable `requestId`, and one of
four operations:

| Operation      | Required payload                                      | Result                                                   |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `capabilities` | none                                                  | versions, scopes, edit kinds, limits, permissions        |
| `query`        | Document ID, scope, optional limits/source spans      | descriptors, diagnostics, truncation evidence            |
| `transact`     | Document ID, revision, transaction ID, typed edits    | applied/dry-run result, diff, typed diagnostics or error |
| `render`       | Document ID, formal/diagnostics mode, optional bounds | bounded base64 SVG artifact and diagnostics              |

No request accepts Project JSON, whole-Document replacement, a filesystem
path, JavaScript, or SVG input.

## Query scopes

Version 1 supports:

- `summary` — counts and presentation identity;
- `selection` — caller-supplied selected object IDs;
- `objects` — explicit object IDs;
- `region` — positioned objects within an integer rectangle;
- `net` — one Net and its members/routes/Junctions;
- `constraints` — layout groups and constraints;
- `diagnostics` — visual diagnostics without object payload;
- `changes` — bounded Agent-committed diffs since a revision.

Object descriptors are stable summaries, not persisted model records. Source
spans require an explicit request and permission. Object count and serialized
text budgets are both enforced; truncation returns `truncated` and
`omittedCount`.

## Permissions

One service instance receives fixed permissions for query, render, source
spans, and the three edit categories. Connectivity permission covers route,
Junction, endpoint, and Net operations. Geometry covers instance creation,
removal, placement, transform, and alignment. Presentation covers
annotation/group/constraint operations. `undo` and `redo` are not Agent API
edit kinds.

Permission denial occurs before the Edit Engine runs and never changes the
Document.

## Transaction semantics

The adapter constructs `{ kind: "agent", id: configuredAgentId }`, then calls
the shared Edit Engine. `expectedRevision`, dry run, operation limits,
atomicity, locks, and complete Document validation retain their existing
meaning. A successful non-dry transaction commits only the returned validated
Document. Responses never return that whole Document.

Version 1.1 adds `add_instance`, `remove_instance`, `connect_endpoints`,
`merge_nets`, and `disconnect_endpoint` to `capabilities.editKinds`. Their
payloads are the shared Edit Engine schemas, so GUI and Agent transaction
sequences validate against the same authoring semantics.

Version 1.2 adds `move_junction` and `set_net_name`. Junction movement requires
geometry permission; Net naming requires connectivity permission. Agents use
the same explicit same-name merge rule as the GUI and cannot connect Nets by
placing decorative text.

## Render semantics

`formal` renders the same export-safe SVG used by the GUI. `diagnostics` adds a
separate `data-layer="agent-diagnostics"` group after formal rendering. The
artifact is base64-encoded with SHA-256 and byte length and is rejected if it
exceeds the configured budget. Diagnostic overlays never enter formal export
or persistence.

## Loopback transport

The optional adapter serves `POST /v1/circuit`, accepts JSON only, sets
`Cache-Control: no-store`, and requires `Authorization: Bearer <token>`. Token
length is at least 32 characters. Hosts other than `127.0.0.1` and `::1` are
rejected. Bodies exceeding the configured limit receive a typed error. The
core service neither starts the server nor reads files.

## Invariants

- Exactly four capability operations exist in v1.
- Every non-capabilities operation targets the currently bound Document ID.
- Queries and renders are bounded by server-owned limits.
- An Agent cannot claim human actor identity.
- A transaction cannot bypass the Edit Engine or commit partial edits.
- Raw Project/Document replacement and arbitrary filesystem access do not
  exist.
- Transport errors and domain errors use deterministic typed codes.

## Valid example

An Agent queries a region at revision 42, dry-runs `align_instances`, commits
the same request with `dryRun: false`, receives revision 43 and the changed IDs,
then requests a diagnostics render of that region.

## Rejected example

A transaction at expected revision 42 after a human committed revision 43
returns `STALE_REVISION`. A caller without connectivity permission cannot add
a Junction even if the payload is otherwise valid.

## Compatibility and migration

Additive query scopes, edit kinds, and descriptor attributes may appear within
an API minor version only when clients can ignore them. Removing or changing
required fields, permission meaning, or operation semantics requires a new API
major version.

## Deterministic validation

- request/response and generated JSON Schema validation
- stable capabilities snapshot
- query scope, permission, source-span, count, and byte-budget tests
- dry-run, stale revision, atomicity, and Phase 8 authoring parity tests
- formal/diagnostics artifact inspection
- authenticated loopback and body-limit tests
