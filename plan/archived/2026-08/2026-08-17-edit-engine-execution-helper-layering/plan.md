---
status: completed
experience: none
---

# Edit Engine execution helper layering

## Goal

Move the remaining non-dispatch helper domains out of `transaction.ts` so
atomic transaction orchestration is separated from preflight, routing, and
instance-annotation follow behavior without changing edit semantics.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/app-transaction-module-layers...origin/codex/app-transaction-module-layers
?? .worktrees/
```

The pre-existing untracked `.worktrees/` directory is unrelated workspace
infrastructure and remains untouched. The preceding module-layer targets are
committed and pushed; there are no overlapping tracked changes.

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction-preflight.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `packages/edit-engine/src/transaction-instance-annotations.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `plan/2026-08-17-edit-engine-execution-helper-layering/plan.md`
- `plan/log.md`

Shared: typed edit and result protocols, model schemas, Symbol Resolver,
derived route geometry, and all transaction behavior. The public package
barrel remains unchanged.

## Work

1. Extract transaction input/grid preflight functions.
2. Extract route validity, connectivity, and geometry-follow helper functions.
3. Extract instance-attached annotation follow functions.
4. Retain `executeTransaction` as the sole atomic mutation boundary and
   add direct coverage only where an extracted pure helper has no existing
   transaction-level protection.

## Validation

- `pnpm test:local packages/edit-engine/src/transaction.test.ts packages/edit-engine/src/protocol-documentation.test.ts packages/agent-adapter/src/request-contract.test.ts`
- `pnpm --filter @icm/edit-engine build`
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target relocates complete internal helper implementations
  without changing their signatures or call sites. The existing atomic
  transaction, protocol-drift, and Agent request-contract suites cover the
  behavior at the public boundary.

## Commit Intent

Commit as:

```text
refactor(edit-engine): layer transaction execution helpers
```

## Outcome

Moved transaction preflight, routing validation, route annotation anchoring and
follow behavior, instance route following, and instance-attached annotation
behavior into focused internal modules. `executeTransaction` remains the
sole atomic mutation boundary. The focused transaction/protocol suite (3
files / 30 tests), Edit Engine build, repository typecheck, test-impact
check, and diff hygiene all passed.
