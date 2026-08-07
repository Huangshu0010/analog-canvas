# ADR 0009: Move Stretches Connected Routes

Status: `proposed`

Date: `2026-08-07`

Owners: `packages/edit-engine`, `packages/derived`

## Context

`move_instance` and `move_junction` change an object's position but do not move
the waypoints of Routes whose endpoints are terminals on that instance or that
Junction. Because Route waypoints are stored as absolute coordinates while
endpoints are derived references, a move that leaves waypoints in place can make
a Route non-orthogonal. The post-loop Route validation then rejects the whole
transaction with `INVALID_RESULT` (`["routes", routeId]`).

The consequence measured in routing-quality review: an Agent that moves a
device drags its connected Routes into an invalid state, the transaction is
rejected, and the Agent learns "do not move placed devices" — so it never
revises placement and produces one-shot, unoptimized layouts. The existing
`proposeLocalStretch` helper in `packages/derived` already computes the correct
waypoint translation for a single-instance move, preserving topology and
orthogonality and respecting `locked`/`trunk` adjacent segments. It is used by
the editor UI today; the Edit Engine does not call it.

## Decision

When `move_instance` is applied, the Edit Engine stretches the Routes whose
terminal endpoints are on the moved instance, using the same
topology-preserving logic as `proposeLocalStretch`. Specifically:

- A Route whose `from`/`to` terminal endpoint is on the moved instance has its
  waypoints translated so the Route stays orthogonal and its escape segments
  keep their axis.
- A Route with an adjacent `locked` or `trunk` segment is NOT stretched; it is
  skipped. If the caller does not re-point that Route later in the same
  transaction, the post-loop validation rejects with `INVALID_RESULT` naming the
  Route (`["routes", routeId]`). This keeps the common move+`set_route_points`
  pattern working: a caller that re-points the protected Route in the same
  batch is not blocked by the stretch skipping it. Stretching never breaks a
  lock.
- Stretching preserves Route topology (same endpoint identity, same number of
  bends unless the original was a zero-waypoint direct Route that now needs one
  L-bend to stay orthogonal, mirroring `proposeLocalStretch`'s existing
  behavior). It does NOT reroute, add detours, or change which Net is connected.
- The touched Routes are added to `changedObjectIds` and their post-move
  resolved polylines are returned in the transact `resolvedRoutes` field (added
  in the protocol self-consistency target), so the Agent sees the actual stored
  geometry without a fresh Snapshot.

`move_junction` is out of scope for this decision: a Junction move still relies
on the existing post-loop Route validation (rejecting with
`["routes", routeId]` if a referencing Route becomes non-orthogonal) and the
caller may follow it with `set_route_points`. A dedicated Junction-stretch
helper is a possible later target; it is not required to remove the primary
"moving a placed device breaks the transaction" failure mode, which is what
`move_instance` stretching addresses.

This is "move, do not reroute": the same closed loop ADR 0008 established for
the expander, applied to interactive moves. It removes the "one move breaks the
whole transaction" failure mode while preserving every electrical and lock
invariant.

## Alternatives considered

### Alternative A — status quo: reject the transaction, require the caller to pre-update Routes

- Benefits: simplest Engine; the caller owns all geometry.
- Costs: the measured failure mode (Agent avoids moving placed devices); high
  caller burden; easy to omit a Route and lose the whole batch.
- Reason not selected: it is the problem being solved.

### Alternative B — auto-reroute the affected Routes to a fresh optimal path

- Benefits: potentially cleaner geometry.
- Costs: the Engine becomes a router; it silently changes topology and may
  override the caller's intended path; contradicts ADR 0008's detect-not-reroute
  discipline.
- Reason not selected: stretching preserves the caller's topology; rerouting
  does not.

### Alternative C — return the affected routeIds and require the caller to stretch

- Benefits: Engine stays minimal.
- Costs: every caller (human GUI, Agent, expander) must reimplement stretch; the
  Engine already imports the derived helpers and the editor already uses them.
- Reason not selected: stretches are deterministic and shared; centralizing them
  in the Engine removes per-caller drift.

## Consequences

### Positive

- A device move no longer drags connected Routes into an invalid state; the
  Agent can revise placement freely.
- The same stretch logic the editor uses is now authoritative for GUI and Agent,
  removing per-caller drift.
- Locks and trunks remain authoritative; stretching never breaks them.

### Negative or limiting

- The Engine takes a stronger position on move semantics: a caller that wanted
  waypoints to stay frozen during a move must use `set_route_points` after the
  move (which is the existing escape hatch).
- Stretching a zero-waypoint direct Route may add one L-bend; this is the
  existing `proposeLocalStretch` behavior and is documented here as expected.
- A Route whose stretch cannot keep it orthogonal (e.g. a degenerate case)
  still rejects with `INVALID_RESULT`, now with `["routes", routeId]`.
- `move_junction` is not stretched by this decision; it still rejects via
  post-loop validation if a referencing Route becomes non-orthogonal.

## Compatibility and migration

- No Project file-format change. Existing Projects are unaffected.
- No Agent API change beyond the already-added `resolvedRoutes` field, which now
  also reports stretch-affected Routes.
- The editor UI's own `proposeGroupMove` path is unchanged for group moves;
  this ADR covers single-instance moves in the Engine.
- `set_route_points` remains the escape hatch for any case the stretch does not
  cover.

## Validation

- A `move_instance` that previously failed `INVALID_RESULT` now succeeds and
  keeps every unprotected connected Route orthogonal.
- A `locked`/`trunk` adjacent segment is skipped, not stretched; if the caller
  does not re-point it in the same batch, the move still rejects with
  `INVALID_RESULT` naming the Route.
- The touched Routes appear in `resolvedRoutes`.
- Canonical topology (Net membership, endpoint identity) is unchanged after a
  stretch.
- Deterministic: the same move produces the same stretched waypoints.

## Related documents

- [`0007-snapshot-driven-agent-workflow.md`](0007-snapshot-driven-agent-workflow.md)
- [`0008-agent-local-route-tree-expander.md`](0008-agent-local-route-tree-expander.md)
- [`../specs/edit-engine.md`](../specs/edit-engine.md)
- [`../specs/connectivity-and-routing.md`](../specs/connectivity-and-routing.md)
- [`../../packages/derived/src/stretch.ts`](../../packages/derived/src/stretch.ts)
