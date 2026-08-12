---
status: completed
experience: none
---

# Connectivity recovery C3 — route geometry semantics

## Goal

Correct the route-geometry contract without destabilising established render or
editor interaction paths. Segment positions are revision-scoped references, not
stable identities; document-level geometry must own cross-route anchor joins.

## State and ownership

The branch is clean after C2b. This target owns `packages/derived` resolved
geometry code/tests/exports, its plan and log. Edit-engine mutation/remap and
renderer/editor migration are read-only: they remain C5/C10 work.

## Work

1. Replace the misleading stable `index` claim with a revision-scoped
   `SegmentRef`/`VertexRef` contract and state that mutation remaps are supplied
   by a future edit planner.
2. Introduce a pure document routing-geometry aggregate that resolves all
   valid routes plus route-anchor joins in one result.
3. Retain positional `segmentIndex` compatibility fields for current consumers;
   do not alter stored routes, hit regions, or SVG bridge output.

## Validation

Focused resolved-geometry/deletion parity tests, workspace typecheck,
Prettier and `git diff --check`.

## Outcome

Route segment and vertex identities now explicitly contain document id,
document revision, route id and position; array indexes remain compatibility
positions only. A documented remap contract makes C5 planners responsible for
cross-edit attachment transfer. `resolveDocumentRoutingGeometry()` now returns
all valid per-route results and deterministic cross-route joins in one pure
document-level read model. No current renderer, editor hit target, stored route
or mutation behavior was changed.

Validation: workspace typecheck; 16 focused resolved-geometry/deletion-parity
tests; targeted Prettier and `git diff --check`.
