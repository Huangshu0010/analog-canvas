# ADR 0005: Agent API Without MCP

Status: `accepted`

Date: `2026-08-07`

Owners: `packages/agent-adapter`, `docs/specs/agent-api.md`

## Context

Human GUI edits and Agent edits must share one Schematic Edit Engine. The
product needs an API that external and embedded Agents can call, but it does
not need MCP discovery, an LLM provider, autonomous planning, or a second edit
command system. Coupling the core to one transport would also make desktop
packaging and security harder.

## Decision

Define Agent Circuit API v1 as a transport-independent TypeScript service with
exactly four operations: `capabilities`, `query`, `transact`, and `render`.

Provide two adapters:

- an in-process service for the editor host and tests;
- an opt-in loopback HTTP adapter using one authenticated JSON endpoint.

The HTTP adapter binds only to `127.0.0.1` or `::1`, requires a bearer token,
limits request bodies, and exposes no filesystem route. It is not started by
the core package. A desktop host may start and stop it explicitly.

The API creates the `agent` edit actor itself. Typed edits pass through the
existing Edit Engine with revision, permission, lock, atomicity, and schema
checks. Query and render outputs are bounded. Render data is base64-encoded and
is never accepted as persistence or mutation input.

MCP is not implemented and no MCP package is added.

## Alternatives considered

### MCP server

- Benefit: ecosystem-standard tool discovery.
- Cost: extra protocol/runtime surface that the product does not currently
  need.
- Decision: rejected by product direction.

### HTTP-only core

- Benefit: immediately callable across processes.
- Cost: transport, authentication, and lifecycle leak into domain behavior.
- Decision: rejected; HTTP remains an adapter around the in-process service.

### Direct Project or Document replacement

- Benefit: superficially simple integration.
- Cost: bypasses invariants, produces large context, and makes diffs and
  revision conflicts unreliable.
- Decision: rejected.

## Consequences

- Embedded and external Agents receive the same operation semantics.
- The API stays small and versionable while edit kinds can grow additively.
- A host must own token distribution and loopback server lifecycle.
- API guidance can describe layout judgment, but program safety remains in
  schemas, permissions, and validators.

## Validation

- request/response JSON Schema and OpenAPI checks
- query budget and permission tests
- GUI/Edit Engine versus Agent transaction parity
- authenticated loopback, body-limit, and non-loopback rejection tests
- repository inspection for MCP dependencies and runtime filesystem access

## Related documents

- [`../specs/agent-api.md`](../specs/agent-api.md)
- [`../specs/edit-engine.md`](../specs/edit-engine.md)
- [`../roadmap/phase-6-agent-api.md`](../roadmap/phase-6-agent-api.md)
