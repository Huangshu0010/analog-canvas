# ADR 0008: Agent-local Route-tree Expander

Status: `proposed`

Date: `2026-08-07`

Owners: `packages/agent-routing`, `skills/circuit-layout`, `docs/agent`

## Context

Routing-quality investigation and the thermometer flat-layout result show the
real bottleneck for Agent-produced schematics: `route_orthogonal` solves
single-edge compliant escape but cannot decide what routing tree a multi-endpoint
Net should use (trunk, branch, labeled-islands, ordered-bus). When several
terminals were each handed to `route_orthogonal` and merged at one Junction, the
result was 144 cross-Net crossings and 32 flightlines; when the Agent instead
reasoned an explicit tree (terminal escape, route-anchor, branch Junction,
trunk split apart) using the same primitives, the result was 0 crossings, 0
flightlines, 0 overlap, 0 diagnostics. The bottleneck is tree choice, not
L-shaped escape arithmetic.

Removing that bottleneck without a server-side router requires an expander:
something that takes a topology decision plus Snapshot geometry and emits
`add_junction` / `route_orthogonal` / `set_route_points` edits with resolved
coordinates, so the Agent stops hand-computing integer waypoints. But an
expander is exactly the shape ADR 0007 warns against if it grows into a
persisted Layout Intent, a query language, or an automatic router.

ADR 0007 accepted a Snapshot-driven Agent workflow and explicitly rejected, as
alternatives, persisting Layout Intent or topology classification, and adding a
generic query language. This ADR places the expander strictly inside that
accepted model.

## Decision

`packages/agent-routing` is an Agent-local, transient, pure-function package.
Its `RouteTreeDecision` input and `RouteTreeExpansion` output are Agent-local
reasoning artifacts. Two hard boundaries govern it.

### Boundary 1 — RouteTreeDecision is Agent-local and transient, not a model layer

- The `RouteTreeDecision` and `RouteTreeExpansion` types live only in
  `packages/agent-routing` (and a thin Skill-side caller). They MUST NOT
  appear in `packages/agent-adapter` request or response schemas, and MUST NOT
  appear in `packages/model` project schema.
- They MUST NOT be persisted into `project.icproj.json`, MUST NOT be stored on
  a Route or any persisted object, and MUST NOT survive across sessions or
  transactions.
- They MUST NOT grow `select`, `query`, `region`, `include`, or `summary`
  capabilities. Their input is a derived slice of an existing Snapshot; they
  introduce no new read path and no new Agent API endpoint. The Agent Circuit
  API v2 surface (`capabilities` / `snapshot` / `transact` / `render`) is
  unchanged.
- A selection rationale ("chose labeled-islands because a continuous trunk
  would cross the matrix") may live in the Agent's own transcript/trace; it
  MUST NOT become a persisted `decisionRationale` field on a Route.

In short: the Skill contract may carry a `RouteTreeDecision`; the Agent
Circuit API contract may not.

### Boundary 2 — the expander detects conflicts but does not auto-reroute

- The v1 expander computes geometry under the chosen tree shape using the
  fixed-style canon (grid, escape, clearance) and detects conflicts against
  existing committed geometry: crossing, overlap, wire-through-symbol, and
  off-grid/escape-direction violations. It returns these as `conflict` and
  `metrics` for the Agent to resolve by changing the tree decision, regrouping
  endpoints, or adjusting placement.
- It MUST NOT silently switch tree shapes when the chosen one does not fit. A
  `shared-trunk` decision that cannot be laid out returns a conflict, not a
  fallback to `direct` or `labeled-islands`.
- There is no `auto` or `best` shape. The Agent MUST submit `shape` explicitly.
  The expander MUST NOT select a shape from fanout, endpoint count, or any
  heuristic.
- The expander MUST NOT reroute to drive a conflict/crossing counter to zero.
  Automatic obstacle avoidance, A* path-finding, and whole-graph cleanup are
  out of scope for v1 and remain possible later targets only with measured
  entry evidence, gated behind ADR 0007's "optional helper" discipline.
- The thermometer 0-crossing result was achieved by tree choice plus
  diagnostic-driven revision, not by an expander rerouting. That evidence is
  the basis for "detect, do not reroute": the closed loop that works is
  Agent chooses tree → expander expands → diagnostics render → Agent revises
  the decision, never expander revises the decision itself.

### Allowed shape set

The v1 shape vocabulary is a finite, explicit set: `direct`,
`local-branch-tree`, `shared-trunk`, `labeled-islands`, `ordered-bus`. The
expander accepts only these. Adding a shape is a contract change to this
package and its knowledge doc, not a runtime capability the Agent invents.

## Alternatives considered

### Alternative A — server-side persisted Layout Intent

- Benefits: reusable planning state, cross-session continuity.
- Costs: constrains Agent reasoning, creates compatibility obligations, adds a
  persisted model layer, and is exactly the "Persist Layout Intent" alternative
  ADR 0007 rejected.
- Reason not selected: ADR 0007 veto; the Agent owns transient circuit
  interpretation.

### Alternative B — auto-routing expander that reroutes to zero conflicts

- Benefits: lower Agent effort, potentially zero-crossing output without
  Agent revision.
- Costs: the expander becomes a router; it silently overrides the Agent's
  tree decision; it contradicts the "helper optional, detect-not-reroute"
  discipline and the thermometer evidence that 0 was reached by tree choice.
  It also re-creates the recipe problem Phase 9 external studies measured as
  harmful.
- Reason not selected: evidence and philosophy both point to Agent-owned tree
  choice with diagnostic feedback, not an automatic router.

### Alternative C — no expander; Agent hand-writes `set_route_points`

- Benefits: zero new surface; simplest contract.
- Costs: the measured bottleneck (multi-endpoint tree arithmetic) remains;
  every waypoint is hand-computed; Agent avoids revision because moving a
  device can break a Route. This is the status quo being improved.
- Reason not selected: status quo is the problem.

## Consequences

### Positive

- Agent stops hand-computing waypoint coordinates; it decides topology and
  grouping, the expander computes geometry.
- The boundary keeps the package inside ADR 0007's accepted model: no new
  endpoint, no persisted model layer, no query language.
- "Detect, do not reroute" preserves Agent ownership of tree choice and keeps
  the expander a pure function with no policy drift.

### Negative or limiting

- A new package must be maintained; its pure functions need deterministic
  tests.
- Conflicts the expander cannot resolve by geometry alone still require an
  Agent revision loop.
- The finite shape set must be extended deliberately; the Agent cannot invent
  shapes at runtime.
- The package is bypassable: the Skill workflow must remain complete with the
  expander disabled (the Agent can still emit raw `set_route_points`). The
  expander is a convenience, not a required API.

## Compatibility and migration

- No Project file-format change. Existing `.icproj` files are unaffected.
- No Agent API v2 change; no new endpoint, request, or response field.
- No `packages/model` or `packages/agent-adapter` schema change.
- `packages/agent-routing` is a new, additive, dependency-only package. The
  Skill gains a caller script; Engine and Adapter are unchanged.
- A `set_route_points` edit remains the escape hatch for cases the expander
  does not cover.

## Validation

- `RouteTreeDecision`/`RouteTreeExpansion` types do not appear in
  `packages/agent-adapter/src/schema.ts` or `packages/model/src/schema.ts`.
- No `project.icproj.json` field references a route-tree decision.
- The expander returns a `conflict` (not a fallback shape) when the chosen
  shape cannot be laid out.
- No `auto`/`best` shape exists; `shape` is required and must be a member of
  the finite set.
- Deterministic unit tests: for a fixed `RouteTreeDecision` + Snapshot slice,
  the expander produces stable `edits`, `resolvedGeometry`, and `metrics`.
- The Skill workflow remains functional with the expander caller disabled
  (Agent emits raw `set_route_points`).

## Related documents

- [`0007-snapshot-driven-agent-workflow.md`](0007-snapshot-driven-agent-workflow.md)
- [`../specs/agent-api.md`](../specs/agent-api.md)
- [`../specs/connectivity-and-routing.md`](../specs/connectivity-and-routing.md)
- [`../agent/workflow.md`](../agent/workflow.md)
- [`../specs/razavi-visual-contract.md`](../specs/razavi-visual-contract.md)
- [`../../skills/circuit-layout/references/manifest.md`](../../skills/circuit-layout/references/manifest.md)
