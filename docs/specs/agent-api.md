# Agent Circuit API

Status: `accepted`

Version: `2.0`

Primary owner: `packages/agent-adapter`

The generated OpenAPI at `/api/agent/openapi.json` is the normative wire
contract. The runtime exposes exactly one Circuit endpoint and four operations:

```text
POST /api/agent/sessions/{sessionId}/circuit
  capabilities | snapshot | transact | render
```

Every request uses `apiVersion: "2.0"`, a stable `requestId`, and the
`sessionId` returned by claim redemption. The bearer token is sent only in the
Authorization header. There are no versioned URL aliases, query operations,
dynamic catalog snapshots, whole-Project mutations, or compatibility readers.
The separate public Agent Kit may carry a static projection of reviewed built-in
product assets; it is not Document state or a Circuit operation.

## Operation contract

| Operation      | Purpose                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `capabilities` | Report the exact operations, permissions, edit kinds, resource capabilities, and server-owned limits. |
| `snapshot`     | Return one complete, read-only selected Document plus the bounded Project index.                      |
| `transact`     | Dry-run or atomically commit typed edits against one exact Document revision.                         |
| `render`       | Return a bounded formal or diagnostics SVG artifact.                                                  |

Snapshot connectivity is bidirectional: every resolved Instance pin reports
its `netId`, and every Net reports its complete terminal membership. Canvas
`port` and `port-filled` are ordinary single-pin Instances. Formal cell
terminal mappings, when present for netlist export, are reported separately and
never materialize canvas Port objects.

VDD is an explicit global Net with Route/Junction rail geometry and an
annotation. It is never a symbol. MOS Instances use canonical `nmos`/`pmos`
assets, whose deterministic default visual variant is
`textbook-3terminal`; explicit bulk connectivity remains a terminal/Net fact.

## Mutation safety

- One transaction targets one Document and one `expectedRevision`.
- A non-trivial edit is dry-run first; commit uses the same edits only while
  the revision is unchanged.
- All edits commit or none commit, and a successful commit advances revision
  once.
- Reuse a `requestId` only for an exact-payload retry. A different payload with
  the same ID is rejected.
- A Snapshot or whole Project is never accepted as a mutation payload.
- GUI and Agent writes cross the same Edit Engine and permission checks.

After commit, render and then request a fresh Snapshot for final verification.
On a stale revision or uncertain transport result, refresh state and reconcile;
do not replay a changed or obsolete transaction.

## File Resource boundary

`POST /api/agent/sessions/{sessionId}/files` is separate from Circuit
operations. It provides only authorized bounded Project/formal-artifact
download and Project/structural-SPICE candidate staging. Staging never changes
the browser Project. Replacement requires explicit human approval in the
editor. The resource provides no filesystem, arbitrary-code, simulator, or
waveform access.

## Validation

Generated JSON Schema and OpenAPI artifacts are checked against the runtime
schemas. Contract tests cover authentication, exact version rejection,
capabilities closure, complete Snapshot topology, typed-edit parity,
request-ID binding, revision conflict, bounded render, and File Resource
approval boundaries.
