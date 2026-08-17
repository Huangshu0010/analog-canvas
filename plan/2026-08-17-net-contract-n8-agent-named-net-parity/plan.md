---
status: completed
experience: none
---

# Net Contract N8 — Agent Named Net Parity

## Goal

Make the Agent client's semantic Net rename action compile through the same
pure named-Net planner as GUI label authoring, while retaining raw transaction
edit behavior for explicit API callers.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated shared worker
infrastructure and remains untouched.

- `packages/agent-client/src/authoring-helper.ts`
- `packages/agent-client/src/authoring-helper.test.ts`
- `packages/agent-adapter/src/index.ts`
- `docs/specs/agent-api.md`
- `docs/roadmap/net-contract-unification-plan.md`
- `plan/2026-08-17-net-contract-n8-agent-named-net-parity/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only dependencies:

- `packages/edit-engine/src/named-net-planner.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/edit-engine/src/transaction.ts`

## Work

1. Re-export the pure planner through Agent client's existing browser-safe
   adapter dependency; Agent client still submits only typed edits through the
   existing adapter and adds no dependency cycle.
2. Compile semantic Net rename with `planEnsureNamedNet`, returning the exact
   ordered planner edits or the planner's structured action error.
3. Add an Agent client regression for case-folded same-name merge and retain
   the raw low-level transaction rejection coverage in Edit Engine.
4. Document that semantic Agent authoring and GUI share planners, while raw
   `transact` remains intentionally strict.

## Validation

- focused Agent client, named planner, and adapter tests
- package/editor build, test-impact, and branch verification
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: semantic Agent Net rename emits the same deterministic merge as
  GUI authoring; explicit raw `set_net_name` does not change.
- Primary checks: Agent helper and named planner regression tests.

## Commit Intent

```text
feat(agent): share named net authoring planner
```

## Outcome

Agent semantic Net rename now compiles through the same pure named-Net planner
as GUI label authoring. The planner is re-exported through Agent client's
existing browser-safe adapter dependency; raw API `set_net_name` behavior is
unchanged.

Validation passed: focused 3-file Vitest run (39 tests), edit-engine/adapter/
Agent-client builds, typecheck, docs check, test-impact, `git diff --check`,
and `pnpm verify:branch` (144 files / 864 tests, workspace build, production
smoke).
