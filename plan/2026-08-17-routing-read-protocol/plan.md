---
status: active
experience: none
---

# Establish Canonical Routing Read Protocol

## Goal

Replace parallel public route-read shapes with one resolved routing geometry and
query surface while preserving the behavior characterized by the preceding
target. This target owns all read-side consumers; route-writing operations are
left to the following edit-ownership target.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/routing-protocol-unification...origin/main [ahead 1]
```

The isolated worktree is clean after the behavior-baseline commit. This target
owns the derived route read/query surface and every direct read-side consumer.

- `packages/derived/src/route-geometry.ts`
- `packages/derived/src/route-query.ts`
- `packages/derived/src/resolved-route-geometry.ts`
- `packages/derived/src/routes.ts` only for read-surface removal
- `packages/derived/src/{anchor,net-label,contact,connectivity,connectivity-index}.ts`
- `packages/render-svg/src/render.ts`
- `apps/editor/src/{app/App.tsx,features/wiring/*}`
- focused tests and plan/log records

Read-only shared dependencies:

- Schema 11 RouteBranch and VisualAnchor persistence
- Edit Engine route mutation operations, to be moved in the next target
- renderer endpoint-join stroke styling

## Work

1. Define the minimal resolved route and document aggregate types; remove
   speculative bounds, hit copies, and revision-reference public surface.
2. Centralize hit/projection/contact/crossing queries while preserving current
   route-tap priority and ordering.
3. Migrate renderer, route tapping, Net Label binding, component placement,
   crossings, and document indexing to the canonical geometry/query surface;
   leave the editor's mutation-preview path input to the following edit target.
4. Remove obsolete read adapters and duplicate read-only shape definitions.

## Validation

- focused route geometry, route tap, interaction, derived connectivity,
  renderer, and routing Edit Engine tests
- relevant editor route-interaction browser tests if hit behavior wiring changes
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: resolved route geometry, route query priority, shared attachment presentation
- Primary checks: resolved route geometry, route tap, route interaction,
  derived connectivity, renderer, and routing tests

## Commit Intent

```text
refactor(derived): establish canonical route geometry
```

## Outcome

Replaced the resolved route compatibility surface with centerline, segment,
vertex, and endpoint-join facts only. The aggregate now derives route-anchor
joins from the same resolved routes, rather than resolving each route twice.
Added shared route projection/tap/contact/crossing queries, migrated route tap,
Net Label binding, component placement contact, renderer marker placement, and
the document connectivity index to that surface.

Removed `RouteAttachmentRemap`, revision-scoped segment/vertex refs,
`hitGeometry`, route bounds, the duplicate editor route-tap module, renderer's
polyline bridge, and the old crossing implementation. The remaining
`RoutePolyline` usage is exclusively the edit-operation bridge and is owned by
the next target.

Focused route tests: 11 files / 82 tests passed. `pnpm typecheck`,
`pnpm test:impact -- --base origin/main`, and `git diff --check` passed.
