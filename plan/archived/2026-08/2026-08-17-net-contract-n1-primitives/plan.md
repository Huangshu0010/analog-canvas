---
status: completed
experience: none
---

# Net Contract N1 — Name and Merge Primitives

## Goal

Establish one case-folded Net-name comparison helper, one reusable
Document-level Net contract validator, and complete `merge_nets` reference
closure. This target does not migrate GUI producers, change Project schema, or
alter global trace/flightline behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated worker infrastructure and
will remain untouched.

- `packages/model/src/net-contract.ts`
- `packages/model/src/index.ts`
- `packages/model/src/net-contract.test.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/authoring.test.ts`
- `plan/2026-08-17-net-contract-unification-plan/plan.md`
- `plan/2026-08-17-net-contract-n1-primitives/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model/src/schema/*`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `packages/netlist/src/extract.ts`
- `docs/roadmap/net-contract-unification-plan.md`

## Work

1. Add pure folded-name and Document Net contract helpers without changing the
   persisted `Net` shape.
2. Use folded-name comparison in `set_net_name` and after each transaction so
   newly committed Documents cannot contain a duplicate named Net.
3. Make `merge_nets` retarget every Net-ID reference, including formal cell
   interface terminals, and prove the closure with transaction tests.
4. Preserve existing explicit merge semantics for raw typed edits.

## Validation

- `pnpm test:local packages/model/src/net-contract.test.ts packages/edit-engine/src/authoring.test.ts`
- `pnpm --filter @icm/model build`
- `pnpm --filter @icm/edit-engine build`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: folded Net-name uniqueness and complete Net-ID reference
  retargeting through `merge_nets`.
- Primary checks: model unit contract and edit-engine authoring transaction
  tests named above.

## Commit Intent

Commit as:

```text
feat(net): add canonical name and merge primitives
```

## Outcome

Added a derived-only folded Net-name key and a reusable Document-level name
contract validator. Transactions reject newly introduced case-folded duplicate
names while allowing legacy violations to remain available for the later repair
target. `merge_nets` now retargets formal cell-interface Net IDs in addition to
existing route, junction, annotation, layout, and MOS references. Focused model
and edit-engine tests and both package builds passed.
