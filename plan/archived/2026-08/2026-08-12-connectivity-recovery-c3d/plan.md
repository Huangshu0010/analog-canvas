---
status: completed
experience: none
---

# Migrate formal route rendering to resolved geometry

## Goal

Make the formal SVG renderer consume `ResolvedDocumentRoutingGeometry` for
route centerlines and endpoint joins, removing its direct `routePolyline()`
read path while preserving the existing visual bridge behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. The target owns formal-render consumers and regression
tests only. Geometry derivation, profile assets, and editor interaction remain
read-only dependencies. This is a bounded one-consumer migration, not a
renderer redesign.

- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `plan/2026-08-12-connectivity-recovery-c3d/plan.md`
- `plan/log.md`

## Work

1. Resolve document route geometry once per render.
2. Feed centerlines and endpoint joins from that result into formal route,
   bridge, and route-marker rendering.
3. Preserve existing SVG golden parity and verify the renderer no longer
   directly calls `routePolyline`.

## Validation

- focused render/geometry Vitest
- render package build and workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(render): consume resolved route geometry
```

## Outcome

Formal SVG rendering now resolves the document geometry once, consumes its
route centerlines, terminal joins, route-anchor joins, bounds, and marker
attachments, and no longer directly calls `routePolyline`. Existing SVG golden
parity and resolved-geometry tests passed.
