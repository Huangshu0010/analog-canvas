# ADR 0014: Resolved Route Geometry

Status: `accepted`

Date: `2026-08-12`

Owners: `packages/derived` (geometry), `packages/render-svg` + editor + export
(consumers)

## Context

There is no single resolved geometry for a Route. Today the stored centerline,
manual path, Agent escape, local/group stretch, the SVG renderer's private
terminal and route-anchor miter bridges (`packages/render-svg/src/render.ts`
`renderTerminalMiterBridges` at `:85` and `renderRouteAnchorMiterBridges` at
`:133`), editor hit targets, segment drag handles, route-marker attachment, and
visual diagnostics each compute or assume slightly different geometry. The
roadmap (§4.3.2, §5.3) identifies this as the second core problem: the same Wire
is seen differently by different consumers, which is why direct-Pin corners and
degree-2 route-anchor joins can show seams or interactive disagreement.

Two behaviors must be preserved verbatim and are pinned by existing tests:
terminal miter bridges close the anti-alias seam at a direct Pin corner without
adding route geometry (`render.test.ts` "bridges direct terminal corners"), and
a degree-2 route-anchor join renders as one continuous dotless wire even when
stored as two Routes (`render.test.ts` "bridges a reconnected dotless
route-anchor").

## Decision

Introduce one derived `ResolvedRouteGeometry` per Route, owned by
`packages/derived` and evolved from the existing `routePolyline`. It is the
single geometry truth for rendering, hit testing, segment drag, marker
attachment, visual/routing diagnostics, and formal export. It is never
persisted.

### Frozen interface

```ts
interface ResolvedRouteGeometry {
  routeId: string;
  netId: string;
  centerline: readonly Point[];          // strictly [from, …waypoints, to]
  segments: readonly ResolvedRouteSegment[];
  vertices: readonly ResolvedRouteVertex[];
  endpointJoins: readonly EndpointJoin[]; // terminal + route-anchor miter bridges
  hitGeometry: readonly HitSegment[];     // screen-tolerant, does not move centerline
  bounds: Rect;
}

interface ResolvedRouteSegment {
  index: number;             // stable identity across split/normalize/stretch
  from: Point;
  to: Point;
  mode: SegmentMode;
  attachmentRemap?: AttachmentRemap; // marker position survives edits
}

interface ResolvedRouteVertex {
  index: number;
  point: Point;
  kind: "terminal" | "port" | "junction" | "bend" | "route-anchor";
}

interface EndpointJoin {
  kind: "terminal-miter" | "route-anchor-miter";
  at: Point;                 // real Pin/Port/Junction origin
  path: readonly Point[];    // the miter bridge stroke the renderer currently emits privately
}

interface HitSegment {
  segmentIndex: number;
  // widened axis-aligned hit region with screen tolerance; never alters centerline
}
```

### Centerline and joins are separate facts

- `centerline` strictly terminates at real Pin/Port/Junction origins. It is
  never secretly extended by the escape length (manual Wire keeps arbitrary
  bend control; Agent escape is an authoring helper, not stored extra points).
- `endpointJoins` carry exactly the miter bridge strokes the renderer currently
  computes privately: the terminal bridge that closes the direct-Pin corner
  seam, and the degree-2 route-anchor bridge that renders two stored Routes as
  one continuous dotless wire. Moving the bridges out of the renderer does not
  add waypoints, change topology, or persist extra points.
- `hitGeometry` permits screen tolerance (zoom-stable pixels) but never moves
  the electrical centerline.
- `bounds` is produced once from this result, not re-estimated by each consumer.
- `segments` carry stable identity and `attachmentRemap` so route markers follow
  physical position across split/normalize/stretch rather than jumping to
  another conductor.

### Ownership and consumer boundary

- Owner: `packages/derived` resolves geometry from the connectivity index
  (ADR 0013) and stored Routes.
- Consumers (read-only): SVG renderer, editor hit testing, segment drag, marker
  attachment, visual/routing diagnostics, formal SVG/PNG/PDF export.
- Mutators: only the Edit Engine changes stored Routes; the resolver is pure.

### Migration order and deletion gate

1. R3 implements `resolveRouteGeometry` additively alongside `routePolyline`.
2. The renderer computes both the private bridges and `endpointJoins`, and
   asserts they agree on existing golden SVGs.
3. One consumer switches at a time (renderer → editor hit/marker → drag →
   export → diagnostics).
4. The renderer's private `renderTerminalMiterBridges` /
   `renderRouteAnchorMiterBridges` and the `data-role="terminal-miter-bridge"` /
   `route-anchor-miter-bridge` private paths are deleted only after the SVG/PNG
   golden and a pixel seam regression pass against `endpointJoins`.

## Amendment — 2026-08-12 recovery semantics

The initial additive implementation supplies useful centerline and bridge
ingredients, but does not yet implement the frozen interface as written. In
particular, an array `index` is **not** stable across split, insertion,
normalization, or stretch. It is only a revision-scoped positional index and
must not be used as a persistent attachment identity.

C3 shall replace that ambiguity with a revision-scoped `SegmentRef` and an
explicit edit/planner-produced `AttachmentRemap`. The remap belongs to the
operation that changes a stored Route; a pure resolver cannot reconstruct every
semantic split after the fact. Marker, hit and drag consumers remain on their
compatibility paths until that contract is implemented and migrated.

`EndpointJoin` is also a raw geometry recipe (`at` and incident directions),
not a profile-specific SVG `path`: stroke overlap is resolved by the renderer's
active style profile. Route-anchor joins are document-level facts, therefore
the final C3 result is a document routing-geometry aggregate containing both
per-route geometry and cross-route joins. The resolver is pure over the
Document and SymbolResolver; C4 may then expose its results through ADR 0013's
index without creating a geometry-to-index dependency cycle.

Accordingly, the dual-compute assertion and consumer migration listed below
are C3/C10 exit conditions, not properties already guaranteed by the current
prototype.

## Alternatives considered

### Alternative A — leave bridges in the renderer

- Benefits: no change to a working seam fix.
- Costs: editor hit, drag, marker, and export continue to re-derive geometry;
  the seam fix stays coupled to SVG output, so PNG/PDF and hit testing can drift.
- Reason not selected: the roadmap requires one geometry truth; coupling the
  bridge to SVG is what prevents sharing it.

### Alternative B — persist bridge waypoints

- Benefits: renderer becomes stateless about bridges.
- Costs: violates the persistence boundary; silently changes stored topology
  and breaks the "manual Wire is not secretly extended" contract.
- Reason not selected: rejected by roadmap §2 and the preservation matrix.

## Consequences

### Positive

- Render, hit, drag, marker, export, and diagnostics share one geometry.
- Direct-Pin corners and degree-2 route-anchor joins are seam-free across all
  outputs, not just SVG.
- Marker attachment and segment identity become stable across edits.

### Negative or limiting

- The renderer loses two private helpers; the seam golden must be re-validated
  against `endpointJoins` before deletion.
- Until R10, both `routePolyline` and `resolveRouteGeometry` coexist.

## Compatibility and migration

Additive only. `routePolyline`, `routeAttachmentPlacement`, `moveRouteSegment`,
and the stretch planners keep their shapes and remain the production path until
their consumers migrate. No schema, fixture, or Project-file change. The bridge
`d` strings currently pinned by `render.test.ts` are preserved verbatim by
`EndpointJoin.path` until a deliberate, golden-backed switch.

## Validation

- WP-R0 `routePolyline` characterization keeps passing.
- R3 dual-compute assertion: renderer private bridge output === `endpointJoins`
  on `phase-1-manual`, `phase-3-crossing`, and `phase-5-dense-analog` goldens.
- Pixel seam regression: rendered SVG/PNG identical before and after the
  consumer switch.
- Negative test: `centerline` is unchanged by adding/removing a terminal bridge.

## Related documents

- [`../../docs/roadmap/connectivity-routing-debugging-plan.md`](../roadmap/connectivity-routing-debugging-plan.md) §5.3, §8 R3
- [`../specs/connectivity-and-routing.md`](../specs/connectivity-and-routing.md)
- [`../specs/export.md`](../specs/export.md)
- [`0013-project-connectivity-index.md`](0013-project-connectivity-index.md)
- [`0009-move-stretches-connected-routes.md`](0009-move-stretches-connected-routes.md)
