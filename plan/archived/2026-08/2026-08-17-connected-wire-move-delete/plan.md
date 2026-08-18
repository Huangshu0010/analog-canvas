---
status: completed
experience: none
---

# Stabilize connected Wire move and deletion

## Goal

Keep connected Wire geometry local and predictable when an Instance moves, and
ensure deleting one selected Route never expands to unselected sibling Routes
through stale or implicit Junction selection.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns the connected-move planning, visual
selection deletion normalization, their focused tests, and its plan/log record:

- `packages/edit-engine/src/route-operations.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `packages/edit-engine/src/routing-geometry.integration.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/canvas/canvas-drag-visual.ts`
- `apps/editor/src/canvas/canvas-drag-visual.test.ts`
- `apps/editor/src/features/selection/delete-selection.ts`
- `apps/editor/src/features/selection/delete-selection.test.ts`
- `apps/editor/src/features/selection/selection-move-plan.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-17-connected-wire-move-delete/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Shared contracts are the persisted Route/Junction topology and the Edit Engine
transaction boundary. Read-only authorities are
`docs/specs/editor-interaction.md` and
`docs/specs/connectivity-and-routing.md`.

## Work

1. Add focused regressions for a moved endpoint preserving the fixed side of a
   direct Route, live per-Route preview geometry, and deleting one branch from
   a shared Junction.
2. Correct local endpoint stretch geometry, preview affected Routes during the
   drag, and prevent Route deletion from expanding through a co-selected
   shared Junction.
3. Run focused and impact validation, then deliver through the review gate.

## Validation

- `pnpm test:local packages/edit-engine/src/routing.test.ts apps/editor/src/features/selection/delete-selection.test.ts apps/editor/src/features/selection/selection-move-plan.test.ts`
- `pnpm test:impact -- --base origin/main`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "previews a connected Wire while its Instance moves"`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: moving one connected terminal changes only endpoint-adjacent
  geometry; deleting one selected Route preserves sibling Routes and a shared
  Junction.
- Primary checks: Edit Engine routing tests plus Editor selection-deletion and
  move-plan tests.

## Commit Intent

Commit as:

```text
fix(editor): stabilize connected wire editing
```

## Outcome

Connected Instance drags now preview the exact per-Route geometry that will be
committed. Direct and boundary Routes use one local endpoint-stretch primitive,
which preserves the fixed-side track instead of moving the elbow to the remote
terminal. Visual deletion now gives explicitly selected Routes priority over
incidental shared Junction dots, so sibling branches survive.

Focused route/selection suites passed (46 tests), the new browser drag scenario
and the existing group-move preview scenario passed, typecheck/build/release
verification passed, all 824 unit/integration tests passed, test-impact and
diff checks passed, and 145 of 146 full browser tests passed. The sole browser
failure was the unrelated pre-existing narrow Library layout timing assertion;
its isolated rerun passed and it is being stabilized as a separate target
before delivery. The target was committed as `4c11e7a`; remote required checks
remain the mainline gate.
