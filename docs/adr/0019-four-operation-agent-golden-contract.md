# ADR 0019: One current four-operation Agent contract

Status: `accepted`

## Decision

Interactive Circuit Maker publishes one exact Agent Circuit contract:
API `2.0`, one `/circuit` resource, and
`capabilities/snapshot/transact/render`. The generated OpenAPI is normative.
All previous request versions, query/catalog operations, versioned URL aliases,
compatibility parsers, and migration-only authoring shapes are deleted.

File transfer is a separate scoped File Resource. It may download canonical
Project/formal artifacts or stage a bounded Project/structural-SPICE candidate.
Staging never changes the browser Project; replacement requires explicit human
approval and revokes the old session.

The Project schema is likewise current-only. Canvas Ports are ordinary
`port`/`port-filled` Instances, VDD is explicit Net/Route rail geometry, MOS
uses canonical `nmos`/`pmos`, and visible labels are RichText annotations.
Agent authoring cannot name retired assets or old model shapes because those
forms are absent from the shared schemas and catalog.

## Reliability rules

- The latest successful claim response is authoritative; bearer tokens stay
  in memory and in Authorization headers only.
- Capabilities is called once per claimed session.
- A request ID is bound to one exact payload and may be reused only for its
  exact retry.
- Non-trivial transactions dry-run and commit only against an unchanged
  revision.
- Render and fresh Snapshot complete final verification.
- Browser/relay state machines, bounded caches, heartbeats, reconnect, and
  typed failure envelopes guard uncertain transport outcomes.

## Validation

Schema/OpenAPI generation, asset-catalog closure, complete Snapshot topology,
GUI/Edit Engine parity, request-ID reuse, stale revision, reconnect/revoke,
File Resource approval isolation, and current-only persistence are mandatory
tests.
