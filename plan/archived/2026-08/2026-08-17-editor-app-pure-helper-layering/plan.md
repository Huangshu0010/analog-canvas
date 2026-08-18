---
status: completed
experience: none
---

# Editor App pure-helper layering

## Goal

Reduce `App.tsx`'s mixed responsibilities by moving reusable, stateless
canvas-selection geometry and drafting-path calculations into their domain
modules without changing editor behavior, React state ownership, or command
execution.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers
?? .worktrees/
```

The untracked `.worktrees/` directory remains unrelated workspace
infrastructure and will not be touched. The preceding Edit Engine target is
committed as `44bde8b`, so this target starts with no overlapping tracked
changes.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/canvas/canvas-geometry.ts`
- `apps/editor/src/canvas/canvas-geometry.test.ts`
- `apps/editor/src/features/drafting/drafting-path.ts`
- `apps/editor/src/features/drafting/drafting-path.test.ts`
- `plan/2026-08-17-editor-app-pure-helper-layering/plan.md`
- `plan/log.md`

Shared: the model `Point`/`Rect` contracts and App's SVG rendering and
marquee-selection consumers. Existing interaction state and Edit Engine calls
are read-only for this target.

## Work

1. Move generic rectangle, segment, boundary, and polyline-bounds functions
   into the canvas geometry module.
2. Move drafting SVG path, quadratic midpoint, and tangent-angle functions
   into the drafting feature.
3. Import the helpers from `App.tsx` and add direct pure-function contract
   tests for the extracted behavior.

## Validation

- `pnpm test:local apps/editor/src/canvas/canvas-geometry.test.ts apps/editor/src/features/drafting/drafting-path.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: inclusive rectangle intersection, segment/boundary selection,
  minimum polyline bounds, and drafting SVG/quadratic geometry remain
  unchanged after extraction.
- Primary checks: canvas geometry and drafting path unit tests plus the
  existing App integration test.

## Commit Intent

Commit as:

```text
refactor(editor): extract App canvas geometry helpers
```

## Outcome

Moved reusable canvas selection geometry into `canvas-geometry.ts` and
drafting SVG/quadratic calculations into `drafting-path.ts`. `App.tsx`
retains interaction orchestration while importing these stateless domain
helpers. Focused tests (3 files / 22 tests), the Editor production build,
repository typecheck, test-impact check, and diff hygiene all passed.
