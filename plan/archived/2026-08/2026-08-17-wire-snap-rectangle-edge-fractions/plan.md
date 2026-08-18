---
status: completed
experience: none
---

# Wire Snap to Rectangle Edge Fractions

## Goal

Expand Wire's non-electrical rectangle-edge snapping from only the midpoint to
the `1/4`, `1/3`, `1/2`, `2/3`, and `3/4` positions on every edge.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean and `main` is current. This target owns:

- `apps/editor/src/snap/candidates.ts`
- `apps/editor/src/snap/candidates.test.ts`
- `plan/2026-08-17-wire-snap-rectangle-edge-fractions/plan.md`
- `plan/log.md`

Shared contract: drafting rectangles and their fractional snap points remain
non-electrical.

## Work

1. Generate the five requested fractional anchors on each resolved rectangle
   edge, including rotated rectangles.
2. Extend the focused candidate regression test to prove all 20 anchors and
   their deterministic positions.

## Validation

- `pnpm test:local apps/editor/src/snap/candidates.test.ts apps/editor/src/snap/engine.test.ts`
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec prettier --check apps/editor/src/snap/candidates.ts apps/editor/src/snap/candidates.test.ts plan/2026-08-17-wire-snap-rectangle-edge-fractions/plan.md`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: each rectangle edge exposes Wire snap points at `1/4`, `1/3`,
  `1/2`, `2/3`, and `3/4`, without electrical metadata.
- Primary checks: `apps/editor/src/snap/candidates.test.ts`,
  `apps/editor/src/snap/engine.test.ts`

## Commit Intent

Commit as:

```text
Expand rectangle edge wire snap points
```

## Outcome

Every rectangle edge now exposes deterministic non-electrical Wire snap
anchors at `1/4`, `1/3`, `1/2`, `2/3`, and `3/4`. The interpolation uses the
resolved corners, so rotated rectangles follow the same contract. Focused Snap
tests passed (2 files / 16 tests), together with formatting, test-impact,
TypeScript, and the root workspace build.
