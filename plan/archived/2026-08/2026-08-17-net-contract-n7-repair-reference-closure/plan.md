---
status: completed
experience: none
---

# Net Contract N7 — Repair Reference Closure

## Goal

Prove that Project-entry legacy canonical-supply repair exercises the complete
existing `merge_nets` reference closure, not merely an empty duplicate-Net
case.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated shared worker
infrastructure and remains untouched.

- `apps/editor/src/presentation/razavi-presentation.test.ts`
- `docs/roadmap/net-contract-unification-plan.md`
- `plan/2026-08-17-net-contract-n7-repair-reference-closure/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only dependencies:

- `apps/editor/src/presentation/razavi-presentation.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/authoring.test.ts`

## Work

1. Build one valid legacy duplicate-Ground Project fixture in the existing
   presentation test with source-Net Route, Junction, Net label, MOS bulk
   binding, and formal terminal references.
2. Assert Project-entry repair selects the deterministic canonical target and
   retargets every listed reference through the ordinary transaction engine.
3. Record this as direct acceptance-matrix evidence without adding a second
   repair implementation.

## Validation

- focused presentation and merge-reference tests
- test-impact, `git diff --check`, and branch verification

## Test Impact

- Decision: tests-updated
- Contracts: legacy duplicate repair has the same complete reference closure as
  `merge_nets`.
- Primary checks: Project-entry repair regression and existing merge tests.

## Commit Intent

```text
test(net): cover repair reference closure
```

## Outcome

Added one valid Project-entry repair regression covering source-Net Route,
Junction, Net label, MOS bulk binding, formal terminal, and terminal
membership. The existing Edit Engine merge transaction remains the sole repair
mechanism.

Validation passed: focused 2-file Vitest run (18 tests), docs check,
test-impact, `git diff --check`, and `pnpm verify:branch` (144 files / 863
tests, workspace build, production smoke).
