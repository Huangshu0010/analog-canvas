# Connectivity and Routing

Status: `accepted`

Version: `1.2`

Owning phase: `Phase 3/8`

Primary owners: `packages/derived`, `packages/edit-engine`

## Purpose

Define how persisted logical Nets and explicit Route/Junction geometry produce
visible connectivity, flightlines, crossings, and safe manual routing edits.

## Consumers

- editor direct Wire, Move, route-handle, and contextual removal interactions
- Schematic Edit Engine
- SVG renderer
- Agent adapter in Phase 6

## Endpoint coordinates

An endpoint resolves as follows:

- terminal: transform the matching Symbol pin by the Instance placement;
- port: use the persisted Port position;
- junction: use the persisted Junction position.

An unplaced Instance, unresolved Symbol/pin, or unpositioned Port has no visible
coordinate. Missing coordinates are diagnostics, not guessed geometry.

## Visible connectivity graph

For each logical Net, graph nodes are its terminal and port members plus its
Junctions. A RouteBranch adds one explicit graph edge between its `from` and
`to` endpoints. Waypoints and geometric intersections add no graph edge.

Each terminal and port belongs to at most one logical Net within a Document.
Multiple-Net membership is rejected because it would make endpoint ownership
and visible-component derivation ambiguous.

Routed components are deterministic connected components ordered by the
lexicographically smallest endpoint key. A route endpoint must be a member of
the route Net; Junction and route `netId` values must match.

## Flightlines

Flightlines are derived overlay edges and are never persisted or formally
exported.

1. Resolve positioned graph nodes and explicit routed components.
2. Choose each component anchor as the positioned node with minimum total
   Manhattan distance to other positioned nodes in that component; break ties
   by endpoint key.
3. Form the complete weighted graph of component anchors.
4. Run Kruskal MST ordered by Manhattan distance and then the two endpoint
   keys.

A net with zero or one positioned component has no flightline. Adding a Route
may merge components and remove flightlines; detaching a Route may restore
them.

## Orthogonal route geometry

The rendered polyline is `[fromPoint, ...waypoints, toPoint]`. Every segment
must be horizontal or vertical and non-zero. Normalization removes consecutive
duplicates and collinear interior points while retaining endpoint identity.
`segmentModes.length` is always `waypoints.length + 1` after normalization.

Segment modes mean:

| Mode     | Meaning                                                         |
| -------- | --------------------------------------------------------------- |
| `auto`   | tool-generated and freely replaceable                           |
| `escape` | short terminal escape owned by local stretch                    |
| `manual` | user-authored geometry                                          |
| `locked` | geometry cannot be changed without an explicit unlock operation |
| `trunk`  | shared manual backbone preserved by local stretch               |

Phase 3 rejects changes to a route containing a locked segment. Trunk segments
remain editable only through explicit route edits; local endpoint stretch does
not translate them.

## Junction and crossing semantics

- Continuous geometry within one RouteBranch is connected without a dot.
- A branch through a Junction endpoint is connected and the Junction renders
  as a solid dot.
- Any X or T intersection lacking an explicit shared Junction remains a
  crossing, including intersections between branches of the same Net.
- A crossing never causes automatic Net merge, route split, or Junction repair.
- Explicit segment targeting atomically replaces the selected branch with two
  branches meeting at a newly persisted Junction.
- Explicit segment targeting splits only that branch. The editor rejects a
  wire end that simultaneously hits multiple branches instead of guessing a
  connected set; intersections merely passed through remain crossings.
- A Junction referenced by any Route cannot be removed.

Crossing diagnostics report geometry that may be visually ambiguous while
preserving the explicit graph unchanged.

## Typed edits

- `set_route_points` creates or replaces one complete RouteBranch.
- `add_junction` creates a Junction and may atomically split one RouteBranch at
  a specified segment into caller-named first/second branches.
- `remove_junction` removes an unused Junction.
- `make_flightline` deletes one RouteBranch and retains its logical Net.
- `connect_endpoints`, `merge_nets`, and `disconnect_endpoint` author logical
  membership independently of route geometry.

All edit preconditions are evaluated on a cloned candidate. A failure rejects
the entire transaction and returns the original Document.

## Move and local stretch

Moving an Instance never changes logical Net membership. The GUI may include
`set_route_points` edits in the same transaction as `move_instance` using a
derived local-stretch proposal:

- only the first or last waypoint adjacent to a moved terminal may change;
- the adjacent waypoint moves on the axis that kept the old endpoint segment
  orthogonal;
- manual interior, trunk, and unrelated routes remain unchanged;
- locked adjacent segments reject the proposal;
- when no waypoint exists, a deterministic elbow is introduced if needed.

For an equal-delta group move, a route whose two terminal endpoints move with
the group translates its waypoints by the same delta. A protected route or one
whose endpoints request different deltas rejects the complete transaction.

## Valid example

Two independent orthogonal branches cross at `(300, 300)` without a Junction.
They render as an X, remain separate graph components on separate Nets, and no
dot is emitted.

## Rejected example

A Route on `net-a` whose terminal endpoint is a member of `net-b`, a diagonal
segment, or a replacement of a locked route is rejected atomically.

## Persistence boundary

Routes and Junctions persist. Endpoint coordinates, polylines, visible graph,
components, flightlines, crossings, diagnostics, tool state, and previews are
derived and absent from Project JSON.

## Deterministic validation

- endpoint transform and unresolved-endpoint tests;
- routed-component and stable MST tests;
- route normalization and orthogonality tests;
- T/X crossing-without-Junction regressions;
- targeted crossing branch split, ambiguous-intersection UI rejection, and
  locked replacement tests;
- detach retaining Net membership;
- formal SVG and Playwright routing closure.
