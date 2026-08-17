---
status: completed
experience: none
---

# Net Contract N2 — Power-Net Producers

## Goal

Replace domain-first power Net selection with one Edit Engine planner used by
Ground placement, legacy VDD marker compatibility, VDD rail construction, and
MOS supply fallback. Ensure incompatible power reassignment rejects atomically.

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
- `packages/edit-engine/src/index.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `packages/model/src/power-domain.ts`
- `packages/model/src/power-domain.test.ts`
- `packages/derived/src/mos-bulk.ts`
- `packages/derived/src/mos-bulk.test.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/vdd-rail.ts`
- `apps/editor/src/features/component-insert/vdd-rail.test.ts`
- `docs/specs/schematic-model.md`
- `docs/specs/edit-engine.md`
- `plan/2026-08-17-net-contract-n2-power-producers/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model/src/net-contract.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `docs/specs/schematic-model.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/roadmap/net-contract-unification-plan.md`

## Work

1. Add a pure power-Net selection/planning module that chooses by canonical
   global name before role and emits existing typed edits only.
2. Make role reassignment and VDD rail authoring reject incompatible names or
   roles atomically.
3. Migrate Ground/VDD producer paths and MOS fallback away from "first matching
   powerDomain" selection.
4. Protect repeated canonical rails/markers and distinct `AVDD`/`DVDD` Nets
   with focused tests.

## Validation

- `pnpm test:local packages/edit-engine/src/power-net-planner.test.ts packages/edit-engine/src/transaction.test.ts packages/derived/src/mos-bulk.test.ts apps/editor/src/features/component-insert/placement-connectivity.test.ts apps/editor/src/features/component-insert/vdd-rail.test.ts`
- `pnpm --filter @icm/edit-engine build`
- `pnpm --filter @icm/derived build`
- `pnpm --filter @icm/editor build`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: canonical power names identify reusable supplies; power role does
  not short distinct named supplies; incompatible reassignment rejects.
- Primary checks: focused planner, transaction, MOS, and component-placement
  tests named above.

## Commit Intent

Commit as:

```text
feat(net): unify power net authoring
```

## Outcome

Added the pure `planEnsurePowerNet` Edit Engine planner, which selects named
canonical supplies before inspecting role metadata and emits only existing typed
edits. Ground/VDD marker compatibility, VDD rail construction, and MOS bulk
fallback now avoid domain-first selection. Direct non-`none` role reassignment
rejects atomically; clearing a role remains available. Focused tests, package
and editor builds, test-impact, formatting, docs-link, and diff checks passed.
