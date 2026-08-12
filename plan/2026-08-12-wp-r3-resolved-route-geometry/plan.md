---
status: completed
experience: none
---

# WP-R3 — Additive Resolved Route Geometry

## Goal

Implement the unified `ResolvedRouteGeometry` (ADR 0014) additively in
`packages/derived`, evolved from the existing `routePolyline`. It adds typed
segments, typed vertices, bounds, hit-segment ingredients, and `endpointJoins`
that carry the raw geometric ingredients of the renderer's private terminal and
route-anchor miter bridges. No production consumer switches this target — the
renderer keeps computing its own bridges (dual); the switch is later.

## Design decisions (profile independence)

- The renderer's bridge `overlap` is `max(wire, symbol stroke) * 0.75`, which is
  profile-specific. `packages/derived` must not depend on a render profile. So
  `endpointJoins` carry **raw ingredients** (origin point + the outward/route
  direction vectors), not profile-scaled paths. The renderer applies its
  `overlap` to produce the final bridge stroke when it migrates.
- Terminal miter joins are per-route (the route's own terminal endpoints) and
  live in `ResolvedRouteGeometry.endpointJoins`. Route-anchor miter joins are a
  cross-route, per-document aggregate (degree-2 anchors shared by two route
  ends), so they are produced by a separate `resolveRouteAnchorJoins(document,
  resolver)`, matching how the renderer emits terminal bridges per route and
  route-anchor bridges per document today.
- Segment attachment remap (marker position survival) is deferred to the marker
  migration (R4/R10); R3 ships stable segment identity (index/mode/from/to).

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0/R1/R2 committed)
```

Owned paths:

- `packages/derived/src/resolved-route-geometry.ts` (NEW)
- `packages/derived/src/resolved-route-geometry.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export)
- `plan/2026-08-12-wp-r3-resolved-route-geometry/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/derived/src/routes.ts` (`routePolyline`, reused for
centerline), `endpoint.ts` (`resolveEndpointOutwardDirection`).
`packages/render-svg/src/render.ts` bridge functions are NOT modified — they
keep producing the production bridges until R10.

## Work

1. `resolved-route-geometry.ts`:
   - Types matching ADR 0014: `ResolvedRouteGeometry`, `ResolvedRouteSegment`
     (`index`, `from`, `to`, `mode`), `ResolvedRouteVertex` (`index`, `point`,
     `kind`), `EndpointJoin` (discriminated `terminal-miter` | `route-anchor-
     miter` with raw origin + directions), `HitSegment` (`segmentIndex`,
     `from`, `to`, `horizontal`).
   - `resolveRouteGeometry(document, resolver, route)` → centerline from
     `routePolyline`; segments one per centerline segment with stable index and
     stored mode; vertices typed (terminal/port/junction/route-anchor at ends,
     bend interior); bounds; hit segments; terminal `endpointJoins` for terminal
     endpoints that have a resolvable outward direction and an axis-aligned
     adjacent segment. Returns `null` on unresolved endpoint.
   - `resolveRouteAnchorJoins(document, resolver)` → one `route-anchor-miter`
     join per degree-2 route-anchor junction (exactly two route-end directions),
     carrying the two direction vectors; degree-1 and degree-≥3 anchors are
     excluded (mirrors the renderer filter).
2. `index.ts` re-export.
3. `resolved-route-geometry.test.ts`:
   - centerline equals `routePolyline`; `null` on unresolved endpoint.
   - segments: count, index, mode, from/to.
   - vertices: terminal at a terminal endpoint, port at a port endpoint, bend
     interior, route-anchor at a route-anchor junction endpoint.
   - bounds correct.
   - terminal endpointJoin present when the pin has an outward direction and the
     adjacent segment is axis-aligned; `routeDirection` is the sign of the first
     segment; absent for a port/junction endpoint.
   - `resolveRouteAnchorJoins`: a degree-2 anchor yields exactly one join with
     two directions; a degree-1 anchor yields none.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on the new `.ts` files
- `git diff --check`

## Commit Intent

```text
feat(derived): add ResolvedRouteGeometry with endpoint join ingredients (WP-R3)
```

## Outcome

Implemented additive `ResolvedRouteGeometry` (ADR 0014). No production consumer
switched — the renderer keeps computing its own bridges (dual); the switch is
later (R10), gated by a seam-golden regression.

- `packages/derived/src/resolved-route-geometry.ts`: `resolveRouteGeometry`
  (centerline from `routePolyline`; typed segments with stable index + mode;
  typed vertices terminal/port/junction/route-anchor/bend; bounds; hit segments
  with orientation, consumer applies tolerance; terminal `endpointJoins`
  carrying raw origin + pin outward + route direction) and
  `resolveRouteAnchorJoins` (document-level degree-2 route-anchor joins with
  the two route-end directions). `endpointJoins` are profile-independent: they
  carry raw direction ingredients; the renderer applies its `overlap` later.
- `packages/derived/src/index.ts`: re-exports the new module.
- `packages/derived/src/resolved-route-geometry.test.ts` (7 tests): centerline
  parity + null; typed segments + hit orientation; vertex kinds
  (junction/bend/port/terminal/route-anchor); bounds; terminal endpointJoin
  present (with pin outward + route direction) and absent for port/junction;
  route-anchor joins for degree-2 and exclusion for degree-1.

Segment attachment-remap (marker position survival) intentionally deferred to
the marker migration (R4/R10); R3 ships stable segment identity.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (92 tests, was 85); `prettier --check` on the new `.ts` files passed;
`git diff --check` clean. Production consumers untouched (additive only).

`status: completed`, `experience: none`.
