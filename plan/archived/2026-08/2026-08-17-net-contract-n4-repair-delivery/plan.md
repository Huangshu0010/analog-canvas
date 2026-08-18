---
status: completed
experience: none
---

# Net Contract N4 — Legacy Repair and Delivery

## Goal

Provide a deterministic Edit Engine repair plan for legacy same-Cell canonical
power-Net duplicates, invoke it at the editor file-open boundary through the
normal transaction path, then run the branch delivery audit.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated worker infrastructure and
will remain untouched.

- `packages/edit-engine/src/power-net-planner.ts`
- `packages/edit-engine/src/power-net-planner.test.ts`
- `apps/editor/src/presentation/razavi-presentation.ts`
- `apps/editor/src/presentation/razavi-presentation.test.ts`
- `apps/editor/src/app/App.tsx` or its current Project-open controller
- `packages/derived/src/connectivity.ts`
- `packages/edit-engine/src/routing.test.ts`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/vite.config.ts`
- `packages/model/src/power-domain.ts`
- `packages/model/src/power-domain.test.ts`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/schematic-model.md`
- `docs/specs/project-file-format.md`
- `docs/user/project-compatibility.md`
- `plan/2026-08-17-net-contract-n4-repair-delivery/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only shared dependencies:

- `packages/project-protocol/src/load.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/model/src/net-contract.ts`
- `docs/adr/0023-rolling-previous-project-compatibility.md`

## Work

1. Build a deterministic canonical power-Net repair plan from existing typed
   merge edits and prove all references retarget through the existing engine.
2. Invoke it in the existing Project-entry materialization operation, before
   editor history/recovery installation, through the normal transaction
   boundary; a repaired opened Project is marked as needing explicit save
   without altering the source file.
3. Keep incompatible same-name/role evidence unmodified and visible as the
   shared blocking diagnostic.
4. Treat an explicitly named global Net as a visible-connectivity bridge, so
   separately drawn Ground/VDD markers do not produce a false flightline.
5. Re-enable the multiple-Ground acceptance scenario through repair, then run
   focused and branch-level verification.
6. Close the direct N2/N3 consumer gaps exposed by readonly edit plans, global
   trace hops, and stale power-normalization expectations before delivery.
7. Move the editor service-worker versioning read to Vite's post-write hook so
   the branch's required build validation reads the emitted `dist/index.html`.

## Validation

- focused repair and Project-open tests
- affected package/editor builds and test-impact
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: legacy compatible duplicate power Nets normalize through the sole
  transaction engine; input files remain untouched until an explicit save.
- Primary checks: planner, transaction, Project-entry, visible-connectivity,
  and Net-trace presentation tests introduced by this target.

## Commit Intent

Commit as:

```text
feat(net): repair legacy power net duplicates
```

## Outcome

Implemented deterministic legacy canonical-power-Net repair through the
existing Project-entry Edit Engine transaction, with explicit-save status for
opened files. Named global Nets now act as visible semantic bridges, removing
false Ground/VDD flightlines. Closed the direct readonly-plan/global-hop
consumer gaps and moved service-worker versioning to Vite's post-write hook.

Validation passed: focused 6-file Vitest run (62 tests), test-impact,
typecheck, `git diff --check`, and `pnpm verify:branch` (143 files / 859 tests,
workspace build, production smoke).
