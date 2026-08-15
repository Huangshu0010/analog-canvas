---
status: completed
experience: none
---

# Junction Follow During Wire-Segment Movement

## Goal

Make direct wire-segment movement treat a visible Junction as a movable
topological vertex, rather than an absolute geometry anchor. Moving a segment
that ends at a Junction must move that Junction and orthogonally stretch every
incident route, including terminal branches.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/junction-stretch-semantics...origin/main
```

The worktree is clean. This target owns the wire-segment stretch proposal,
editor preview if required for parity, focused tests, and plan/log records.

- `packages/derived/src/stretch.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/app/App.tsx` only if preview needs the same proposal
- `plan/`

Read-only shared contracts: route normalization, edit-transaction validation,
and rendered route geometry. No electrical Net membership changes are allowed.

## Work

1. Replace the degree-based hard-anchor heuristic with vertex-follow behavior
   for Junction endpoints of a dragged segment.
2. Preserve orthogonality by applying one Junction move plus endpoint stretch
   proposals to every incident route in one transaction.
3. Add regression coverage for a three-way Junction whose horizontal segment
   is moved perpendicular to itself.

## Validation

- `pnpm test:local packages/derived/src/derived.test.ts packages/edit-engine/src/routing.test.ts`
- relevant editor interaction/browser test if preview changes
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(wiring): move junctions with dragged wire segments
```

## Outcome

Segment dragging now treats every Junction endpoint as a movable topological
vertex. The transaction moves that vertex and orthogonally stretches all of its
incident Routes; terminal endpoints remain fixed. A three-way-junction
regression covers the previously anchored horizontal-segment case.

Focused derived/edit-engine tests (34), typecheck, Prettier, and diff checks
passed.
