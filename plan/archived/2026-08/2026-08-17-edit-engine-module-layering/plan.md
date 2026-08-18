---
status: completed
experience: none
---

# Edit Engine module layering

## Goal

Separate the public typed-edit protocol and transaction result envelope from
the Edit Engine execution implementation without changing schemas, exports, or
mutation behavior.

## State and Ownership

Start state from `git status --short --branch` before branch creation:

```text
## codex/examples-rail-closeout...origin/codex/examples-rail-closeout
?? .worktrees/
```

The source branch had no commits or tracked diff relative to `origin/main`.
The untracked `.worktrees/` directory is existing workspace infrastructure,
does not overlap this target, and remains untouched. Work continues on
`codex/app-transaction-module-layers`.

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction-result.ts`
- `packages/edit-engine/src/index.ts`
- `plan/2026-08-17-edit-engine-module-layering/plan.md`
- `plan/log.md`

Shared: `@icm/model` schemas, the public `@icm/edit-engine` barrel, Agent edit
schema derivation, and Edit Engine transaction tests. These contracts may be
re-exported but not changed.

## Work

1. Move the complete Zod edit/transaction registry and inferred input types to
   `edit-schema.ts`.
2. Move result, diagnostic, execution-context, and rejection-envelope types to
   `transaction-result.ts`.
3. Keep `transaction.ts` as the execution/domain-validation layer and preserve
   its historical direct exports through compatibility re-exports.

## Validation

- `pnpm test:local packages/edit-engine/src/transaction.test.ts packages/edit-engine/src/protocol-documentation.test.ts packages/agent-adapter/src/request-contract.test.ts`
- `pnpm --filter @icm/edit-engine build`
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target moves unchanged declarations and preserves both package
  and historical direct-module exports; existing transaction, documentation
  drift, and Agent-derived-schema tests protect the public protocol.

## Commit Intent

Commit as:

```text
refactor(edit-engine): separate transaction protocol layers
```

## Outcome

Separated the Edit Engine's Zod input protocol into `edit-schema.ts` and its
result/rejection protocol into `transaction-result.ts`. `transaction.ts`
now owns execution and domain validation while compatibility re-exports keep
historical direct imports working. Focused protocol tests (3 files / 30
tests), the Edit Engine build, repository typecheck, test-impact check, and
diff hygiene all passed.
