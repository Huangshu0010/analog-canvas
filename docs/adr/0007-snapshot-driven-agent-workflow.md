# ADR 0007: Snapshot-driven Agent workflow

Status: `accepted`

## Decision

The sole Agent Circuit API is version 2.0 with exactly
`capabilities/snapshot/transact/render`. An Agent calls capabilities once,
chooses one authorized Document, and requests one complete Snapshot. It does
not plan queries or retrieve partial regions.

Snapshot exposes complete bidirectional pin/Net membership, resolved Route
geometry, Junctions, annotations, presentation, diagnostics, a bounded Project
index, revision, and topology hash. It is read-only and cannot be submitted as
a replacement mutation.

Transactions use typed Edit Engine edits against one exact revision. Risky
edits are dry-run before commit; after commit the Agent renders and refreshes
Snapshot. GUI and Agent operations have semantic parity.

There is no v1 reader, query operation, versioned loopback alias, or
compatibility envelope. JSON Schema/OpenAPI and contract tests derive from the
single current runtime schema.

## Consequences

- Agents receive all relevant circuit evidence before reasoning.
- Snapshot payloads require explicit byte/performance limits.
- Clients refresh on stale revisions and uncertain transport outcomes.
- Complete-topology and stable-order tests replace query-planning tests.
