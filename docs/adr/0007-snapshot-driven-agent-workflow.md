# ADR 0007: Snapshot-Driven Agent Read Path

Status: `accepted`

Date: `2026-08-07`

Owners: `packages/agent-adapter`, `skills/circuit-layout`, `docs/agent`

## Context

Agent API v1 deliberately exposed bounded query scopes so an Agent could avoid
receiving a whole persisted Document. Real RLC and hierarchical CDAC work showed
a different bottleneck: an Agent needs complete pin-to-Net, Net-to-terminal,
Route, constraint, and diagnostic facts before it can reason reliably. Asking
the Agent to plan `summary/region/net/topology/select/expand/include` queries
spends reasoning on the product protocol, risks omitting decisive evidence, and
would grow into a query language.

The product must still prevent whole-Document replacement, enforce permissions
and revision checks, preserve one `.icproj`, and support existing v1 clients.
Large-circuit concerns must be measured rather than assumed; a hierarchical
Project already provides a natural complete-Document boundary.

## Decision

Define Agent Circuit API v2 with exactly four operations:

- `capabilities`;
- `snapshot`;
- `transact`;
- `render`.

`snapshot` returns a deterministic, complete, read-only
`AgentSessionSnapshot` containing a small Project/Document reference index and
one selected `AgentDocumentSnapshot`. The Document view includes complete
electrical and presentation facts needed for reasoning: ports, instances with
resolved pins and Net membership, Nets with terminal membership, complete Route
geometry, Junctions, annotations, groups, constraints, locks, bounds, source
metadata allowed by permissions, and spatial diagnostics.

Instance-to-Net and Net-to-terminal views are intentionally redundant derived
indexes generated from one validated Document and checked for consistency. A
stable topology hash identifies the electrical/presentation snapshot content.

The Snapshot has a separate schema/version, is never persisted by default, and
is never accepted as mutation or save input. Every write remains a typed
`transact` request through the Edit Engine.

A host may inject capabilities and the first Snapshot at task start. Agents
request another Snapshot only to switch Documents, recover from stale/external
changes, or perform a fresh global review. Complete Document delivery is the
default through at least the measured 500-instance baseline. If a real flat
Document exceeds a host/context budget, transport may chunk the serialized
Snapshot deterministically; chunks do not add region or topology semantics.

Agent-facing documentation has two runtime parts: one thin governing
`SKILL.md`, plus knowledge documents loaded on demand. Optional topology or
routing helpers are not part of the core read path and require measured entry
evidence after Snapshot-driven trials.

## Alternatives considered

### Extend v1 with a generic query language

- Benefits: small responses and additive fields.
- Costs: incomplete evidence, query-planning burden, schema growth, and a new
  semantic layer between the circuit and Agent.
- Reason not selected: it optimizes transport before measuring context limits
  and consumes Agent reasoning without improving circuit understanding.

### Return raw `.icproj` or accept whole-Document replacement

- Benefits: minimal projection implementation.
- Costs: exposes storage details and irrelevant data; cannot include useful
  derived indexes safely; whole replacement bypasses typed diffs, permissions,
  locks, and revision semantics.
- Reason not selected: Snapshot is a read model, not a second persistence or
  mutation path.

### Persist Layout Intent or topology classification

- Benefits: apparently reusable planning state.
- Costs: constrains Agent reasoning, creates compatibility obligations, and
  still fails to express many large analog exceptions.
- Reason not selected: the Agent owns transient circuit interpretation.

### Always split large Documents into semantic regions

- Benefits: smaller per-call payload.
- Costs: region boundaries can remove evidence and become another inferred
  semantic truth.
- Reason not selected: select a complete Document first; add only measured,
  semantics-free transport chunking when necessary.

## Consequences

### Positive

- The Agent receives all electrical evidence before reasoning.
- The core workflow is flat and no longer depends on query planning.
- Snapshot JSON can be inspected, tested, hashed, and injected into any Agent
  host without MCP.
- Typed writes and GUI/Agent parity remain unchanged.
- Skill and knowledge design can focus on circuit understanding rather than
  context retrieval mechanics.

### Negative or limiting

- Snapshot payloads are larger and need explicit byte/token/performance gates.
- The adapter must maintain a separate derived schema and stable ordering.
- v1 and v2 coexist during migration.
- Bidirectional convenience indexes require deterministic consistency tests.
- Snapshot consumers must refresh after stale revisions instead of assuming a
  permanently live view.

## Compatibility and migration

- API v1 remains accepted with `capabilities/query/transact/render` and its
  existing schemas during the compatibility window.
- API v2 uses `capabilities/snapshot/transact/render`; it does not add generic
  selectors to v1.
- `transact` and `render` retain their semantic payloads; their envelope accepts
  the selected major version.
- The loopback adapter continues `/v1/circuit` and adds `/v2/circuit`.
- Existing `.icproj` files require no migration because Snapshot is derived.
- Removal of v1 requires a later ADR and major-version deprecation evidence.

## Validation

- request/response JSON Schema and OpenAPI artifacts for both versions
- deterministic Project Index and complete Snapshot fixtures
- pin/Net bidirectional consistency and stable topology hash
- assertion that no Snapshot/Project replacement request exists
- source permission and stale revision behavior
- payload bytes, approximate serialized tokens, and generation time at 100 and
  500 instances plus the selected 100+ transistor circuit
- RLC/CDAC/unseen vertical traces with v1 query path unused
- Skill/core workflow with optional helpers disabled
- authenticated `/v1/circuit` and `/v2/circuit` loopback tests

## Related documents

- [`0005-agent-api-without-mcp.md`](0005-agent-api-without-mcp.md)
- [`../specs/agent-api.md`](../specs/agent-api.md)
- [`../agent/rule-guided-layout-architecture.md`](../agent/rule-guided-layout-architecture.md)
- [`../agent/knowledge-and-skill-plan.md`](../agent/knowledge-and-skill-plan.md)
- [`../roadmap/phase-9-agent-reasoning-and-observability.md`](../roadmap/phase-9-agent-reasoning-and-observability.md)
