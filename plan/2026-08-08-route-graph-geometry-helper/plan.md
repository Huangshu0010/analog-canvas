# Route-graph geometry helper (demote expander to a toolbox)

## Goal

Correct the abstraction drift diagnosed in review: the current expander is a
"shape compiler" that decides junction count, trunk line, tap order, and hub
connectivity from a compressed `shape` + `endpointGroups` decision. That
silently moves the Agent's visual-topology judgment into a weak deterministic
planner, which is exactly why the CDAC output was visually bad and why the
old hand-scripted output was better.

Replace the shape-compiler model with a **nodes/edges geometry helper**: the
Agent gives a complete local Route graph (nodes + edges with roles); the helper
only projects each edge onto legal coordinates (grid snap, terminal escape,
orthogonal bend, trunk split, stable IDs, typed-edit assembly). The helper
never decides topology, never adds a missing node, never switches a shape,
never reroutes. The five shapes become optional graph constructors the Agent
may call and then edit, not a closed mandatory enum.

This keeps ADR 0008's boundary (detect, do not reroute; Agent owns topology)
and ADR 0007's boundary (transient, client-side, not persisted, no API
surface). The `RouteGraph`/`RouteGraphExpansion` types live only in
`@icm/agent-routing`.

## New interface (types.ts)

```ts
// A node the Agent places. `endpoint` nodes reference existing
// terminals/ports (no object created). `tap`/`junction` nodes are created by
// the helper via add_junction. A node carries ONE position hint so the helper
// can resolve its coordinate without guessing topology.
export interface RouteGraphNode {
  id: string;
  role: "endpoint" | "tap" | "junction" | "label-anchor";
  // For role:"endpoint": the existing terminal/port this node binds to.
  endpoint?: RouteEndpoint;
  // For role:"tap"|"junction": where to place it. Exactly one of:
  //   - alignWith: a node id whose coordinate this node shares on `axis`
  //     ("x" => same column, "y" => same row). The perpendicular coordinate
  //     comes from `offset` or a `between` pair.
  //   - at: an explicit point (already grid-aligned by the Agent).
  alignWith?: string;
  axis?: "x" | "y";
  offset?: number;        // perpendicular offset from alignWith, in scene units
  at?: Point;
}

export type RouteEdgeRole = "trunk" | "escape" | "link" | "label";

export interface RouteGraphEdge {
  id: string;
  from: string;           // node id
  to: string;             // node id
  role: RouteEdgeRole;
  // label edges carry the Net label text + the node/port the label attaches to.
  label?: { text: string; attachedObjectId: string };
  // escape/link mode when the helper emits set_route_points (default "auto").
  segmentMode?: SegmentMode;
}

export interface RouteGraph {
  documentId: string;
  revision: number;
  netId: string;
  nodes: RouteGraphNode[];
  edges: RouteGraphEdge[];
}
```

## Helper contract (`expand.ts`)

`expandRouteGraph(graph, input): RouteGraphExpansion`:

1. Resolve every node's coordinate:
   - `endpoint` → from `input.endpoints` (its resolved point + outward).
   - `tap`/`junction` with `at` → use it (snap-asserted).
   - `tap`/`junction` with `alignWith` + `axis` + `offset` → derive: share the
     aligned coordinate from the referenced node, perpendicular = referenced
     node's perpendicular ± offset.
   - If a non-endpoint node has neither `at` nor `alignWith` → `MISSING_NODE_POSITION` conflict (no median guess).
2. Emit `add_junction` for every `tap`/`junction`/`label-anchor` node (stable id from node id).
3. For each edge, emit exactly one typed edit:
   - `escape` → `route_orthogonal` (Engine computes the pin-aware escape).
   - `trunk` → `set_route_points` with segmentMode `trunk`, between the two junction endpoints (waypoints `[]`, single `trunk` segment).
   - `link` → `set_route_points` with the given/default segmentMode.
   - `label` → `upsert_annotation` net-label at the target node's coordinate.
4. Return `edits`, `resolvedGeometry` (one polyline per non-label edge, snapped), `metrics`, `assumptions`, `conflicts`.
5. Trunk-splitting: when multiple `trunk` edges share a tap node, the helper
   emits them as separate `set_route_points` routes that all terminate at that
   junction — so the Agent controls segmentation by how it lays out tap nodes
   and trunk edges. The helper does NOT auto-merge or auto-split; it lays out
   exactly the edges given.
6. Conflict-only returns for: missing endpoint, missing node position, an edge
   referencing an unknown node. Never invents a node or edge.

## Shape constructors (optional, advisory)

Keep `buildSharedTrunkGraph`, `buildOrderedBusGraph`, `buildLocalBranchTree`,
`buildLabeledIslands`, `buildDirectGraph` as **graph constructors** that return
a `RouteGraph` the Agent inspects and may edit before calling
`expandRouteGraph`. They are NOT the expansion path. Document in
`route-tree-shapes.md` that these are starting points, not a closed enum, and
the Agent is expected to adjust taps/axes/exceptions.

The old `expandRouteTree(decision, input)` entrypoint is removed (or kept as a
thin shim that calls a constructor then expandRouteGraph, for migration — to
be decided in implementation; default: remove, update callers).

## What this removes

- The expander no longer computes trunk position (median or otherwise) — the
  Agent places taps/junctions explicitly.
- No `anchors` parsing (the previous anchor plan is superseded; positions are
  in the graph nodes directly).
- No shape-as-compiler: `shape` is not an input to the helper; it is only a
  constructor name.
- `labeled-islands` no longer auto-creates labels — the Agent adds `label`
  edges where it wants them.

## Recipe changes (`agent-cdac-flat.mjs`)

Rewrite `buildEditPhases` to construct, per Net, an explicit `RouteGraph`
reflecting the intended visual topology:
- vout: a vertical common-plate trunk with one tap per cap.1 (cap pins share
  x, so taps are stacked along the trunk; the Agent decides the trunk x and
  tap ys), plus an escape edge per cap to its tap, plus the trunk edges between
  consecutive taps, plus the XRESET.D and vout port links.
- vdd: a vertical rail to the east of the units with one tap per unit.vdd,
  escape edges, and trunk edges; the vdd port links to one rail endpoint.
- vss: labeled islands — explicit local branch junctions + label edges at each
  island (no cross-island wire).
- bot/b/reset: a single escape edge (direct) each.

This is more code in the recipe, but it is the Agent's topology judgment made
explicit, which is the whole point.

## Tests

- `expandRouteGraph` with an explicit graph → exact edits + resolved geometry.
- Missing endpoint / missing node position / unknown node → conflict, no edits.
- A `trunk` edge between two tap nodes → `set_route_points` trunk route.
- An `escape` edge → `route_orthogonal`.
- A `label` edge → `upsert_annotation` net-label.
- Shape constructors return reviewable graphs; `buildSharedTrunkGraph` on a
  simple endpoint set yields taps + trunk + escape edges the Agent can edit.
- Determinism: same graph + input → identical output.

## Out of scope

- Automatic tap staggering for collinear escapes (still the Agent's call; the
  metrics report it).
- The CDAC visual quality target itself — this plan fixes the abstraction; the
  recipe expresses the intended topology. Visual re-tuning of the recipe is a
  follow-up iteration after the helper lands.

## Validation

- `pnpm typecheck`, `prettier --check`, `vitest run packages/agent-routing`.
- Re-run the CDAC recipe; confirm the emitted routes match the explicit graph
  (no median, no auto-hub) and diagnostics are reviewable.
- `git diff --check`.

## Commit Intent

```text
refactor(agent-routing): demote expander to a route-graph geometry helper
```
