---
status: completed
experience: none
---

# Net Contract N5 — Named Net Planner

## Goal

Finish the missing generic named-Net authoring boundary: a pure Edit Engine
planner lets a high-level caller rename, reuse, or explicitly merge a named Net
without weakening the low-level `set_net_name` ambiguity rejection.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated shared worker
infrastructure and remains untouched.

- `packages/edit-engine/src/named-net-planner.ts`
- `packages/edit-engine/src/named-net-planner.test.ts`
- `packages/edit-engine/src/index.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts` only if the current label workflow
  can be covered cleanly through its existing browser fixture
- `docs/specs/edit-engine.md`
- `docs/specs/schematic-model.md`
- `docs/roadmap/net-contract-unification-plan.md`
- `plan/2026-08-17-net-contract-n5-named-net-planner/plan.md`
- `plan/log.md`

Read-only dependencies:

- `packages/model/src/net-contract.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/agent-client/src/authoring-helper.ts`

## Work

1. Add a pure name-first planner that returns existing typed edits only:
   preserve a candidate's name when it already matches, rename it when the
   name is unused, and merge it deterministically into the existing
   same-folded-name Net when compatible.
2. Keep role/scope conflicts as explicit planner rejections and retain the
   low-level `set_net_name` rejection for raw callers.
3. Route the GUI Net-label rename path through the planner, so a human gets the
   same merge semantics as power authoring rather than a transaction error.
4. Record the completed generic planner boundary in the current contracts and
   road map; do not broaden this target to SPICE/Agent intent migration.

## Validation

- focused planner, transaction, and Net-label editor tests
- affected package/editor builds and test-impact
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: high-level same-folded-name authoring yields an explicit merge;
  raw ambiguous `set_net_name` remains rejected.
- Primary checks: named planner unit tests, existing transaction rejection
  regression, and Net-label UI coverage.

## Commit Intent

Commit as:

```text
feat(net): unify named net authoring
```

## Outcome

Added `planEnsureNamedNet` as a pure Edit Engine planning boundary and routed
GUI Net-label naming through it. High-level same-folded-name naming now emits a
deterministic explicit merge, while raw `set_net_name` continues to reject
ambiguity. No mutation protocol was added.

Validation passed: focused 3-file Vitest run (19 tests), package/editor builds,
typecheck, docs check, test-impact, `git diff --check`, and
`pnpm verify:branch` (144 files / 862 tests, workspace build, production
smoke).
