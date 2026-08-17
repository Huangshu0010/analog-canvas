---
status: completed
experience: none
---

# Wire Snap to Rectangle Edge Centers

## Goal

Allow the Wire tool to geometrically snap to the midpoint of each drafting
rectangle edge without turning the rectangle or the snapped point into an
electrical contact.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns:

- `apps/editor/src/snap/candidates.ts`
- `apps/editor/src/snap/candidates.test.ts`
- `apps/editor/src/snap/engine.ts`
- `apps/editor/src/snap/engine.test.ts`
- `apps/editor/src/app/App.tsx`
- `plan/2026-08-17-wire-snap-rectangle-edge-centers/plan.md`
- `plan/log.md`

Shared contract: drafting geometry remains non-electrical; only explicit
terminals, Junctions, and Route taps create contact.

## Work

1. Derive deterministic snap anchors at the four edge midpoints of each
   drafting rectangle.
2. Admit those drafting anchors to Wire point snapping while leaving contact
   resolution limited to electrical endpoints and Routes.
3. Add focused regression tests for edge-center generation and non-electrical
   Wire snapping.

## Validation

- `pnpm test:local apps/editor/src/snap/candidates.test.ts apps/editor/src/snap/engine.test.ts`
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec prettier --check apps/editor/src/app/App.tsx apps/editor/src/snap/candidates.ts apps/editor/src/snap/candidates.test.ts apps/editor/src/snap/engine.ts apps/editor/src/snap/engine.test.ts plan/2026-08-17-wire-snap-rectangle-edge-centers/plan.md`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Wire snaps geometrically to rectangle edge centers without
  creating an electrical match.
- Primary checks: `apps/editor/src/snap/candidates.test.ts`,
  `apps/editor/src/snap/engine.test.ts`

## Commit Intent

Commit as:

```text
Allow wire snapping to rectangle edge centers
```

## Outcome

Wire now includes the four edge midpoints of every drafting rectangle in its
geometric snap candidates. These anchors have no electrical reference, so a
snapped Wire endpoint remains a free point and cannot create implicit contact.
The two focused Snap suites passed (15 tests), as did test-impact, formatting,
TypeScript, and the root workspace build.
