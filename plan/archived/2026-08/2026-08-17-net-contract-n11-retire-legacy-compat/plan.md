---
status: completed
experience: none
---

# Net Contract N11: Retire Legacy Compatibility Paths

## Goal

Remove the legacy power-Net normalization edit and Project-entry duplicate-power
repair. New Projects use only the current named/power authoring planners and
the Edit Engine's strict validation; old malformed projects are not repaired
silently.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

`.worktrees/` is unrelated shared worker infrastructure and remains untouched.
This target owns the obsolete edit protocol, entry-repair branch, generated API
contract refresh, affected tests, and contract documentation.

- `packages/model/src/power-domain.ts`
- `packages/model/src/power-domain.test.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `packages/edit-engine/src/power-net-planner.ts`
- `packages/edit-engine/src/power-net-planner.test.ts`
- `packages/agent-adapter/src/service.ts`
- `apps/editor/src/presentation/razavi-presentation.ts`
- `apps/editor/src/presentation/razavi-presentation.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/mcp-server/src/resources.generated.ts`
- `docs/specs/edit-engine.md`
- `docs/roadmap/net-contract-unification-plan.md`
- `plan/2026-08-17-net-contract-n10-roadmap-closure/plan.md`
- `plan/2026-08-17-net-contract-n11-retire-legacy-compat/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only: `set_net_name`, `merge_nets`, named/power planners, and current
project-file schema. Shared: the generated Agent/MCP request contract.

## Work

1. Delete `normalize_power_nets` from the edit schema, transaction execution,
   routing helper, model helper, Agent raw allowlist, tests, and generated API
   contract.
2. Stop Project-entry canonical power-Net repair; retain only the current MOS
   bulk materialization that is part of the active presentation contract.
3. Remove the now-private legacy repair helper and regression fixtures, update
   documentation to state that invalid duplicate names are rejected.
4. Preserve `set_net_name` and `merge_nets` as the current atomic Edit Engine
   operations used by planners, not as compatibility APIs.

## Validation

- focused model, Edit Engine, editor presentation, Agent-adapter tests
- generated Agent/MCP catalog checks
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: current authoring remains planner-driven; the retired normalizer
  and entry repair are unavailable to raw callers and project opening.
- Primary checks: affected package tests and generated contract checks.

## Commit Intent

Commit as:

```text
refactor(net): retire legacy normalization compatibility
```

## Outcome

Removed `normalize_power_nets` from the model helper, Edit Engine schema and
execution path, Agent capability contract, generated OpenAPI/MCP resources, and
regressions. Project entry no longer coalesces duplicate canonical power Nets;
it retains only current MOS bulk materialization. `set_net_name` and
`merge_nets` remain the current planner primitives. Focused tests, generated
artifact checks, typecheck, test-impact, and `pnpm verify:branch` passed (143
test files / 860 tests, workspace build, production smoke).
