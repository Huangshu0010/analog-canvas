---
status: completed
experience: none
---

# Characterize Current Routing Behavior

## Goal

Create focused, behavior-level protection for the current routing geometry,
interaction, editing, and route-attached annotation behavior before the
routing-protocol clean break. This target changes no production behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/routing-protocol-unification...origin/main
```

The isolated worktree is clean and starts at `origin/main` commit `442162e`.
This target owns only routing characterization tests and its plan/log records.

- `packages/derived/src/*route*.test.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/features/wiring/*.test.ts`
- `packages/render-svg/src/current-contract.test.ts`
- `plan/2026-08-17-routing-behavior-baseline/plan.md`
- `plan/log.md`

Read-only shared contracts:

- Schema 11 Route and VisualAnchor model shapes
- Edit Engine transaction envelope and current route planners
- Existing editor browser workflows

## Work

1. Inventory existing focused routing tests and identify behavior protected only
   indirectly after the resolved-geometry suite removal.
2. Add small primary characterization tests for retained route geometry and
   query behavior, without asserting obsolete compatibility shapes.
3. Run the focused routing behavior suite and record the resulting baseline.

## Validation

- `pnpm test:local packages/derived/src/route-edit.test.ts packages/derived/src/resolved-route-geometry.test.ts apps/editor/src/features/wiring/route-tap.test.ts apps/editor/src/features/wiring/route-interaction-geometry.test.ts packages/edit-engine/src/routing.test.ts packages/derived/src/annotation-presentation.test.ts packages/render-svg/src/current-contract.test.ts packages/agent-routing/test/expand.test.ts packages/agent-routing/test/integration.test.ts`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: current route resolution, query priority, editing, and attachment behavior
- Primary checks: the focused routing test command above

## Commit Intent

```text
test(routing): characterize current route behavior
```

## Outcome

Restored a direct resolved-route geometry contract focused on the retained
reading surface: canonical centerline, ordered segment/vertex data,
unresolved endpoints, terminal miter ingredients, and deterministic
route-anchor aggregation. It deliberately does not protect the obsolete
compatibility refs, duplicated hit geometry, or bounds slated for removal.

Focused routing tests: 9 files / 73 tests passed. `pnpm test:impact -- --base
origin/main` passed because this target changes tests only; `git diff --check`
passed.
