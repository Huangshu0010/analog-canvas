---
status: completed
experience: none
---

# Schema 15 Baseline Reconciliation

## Goal

Repair the two stale schema-version assertions that predate the accepted
schema-15 external-subcircuit protocol so the already-current runtime and
rolling schema-14-to-15 reader pass branch validation.

## State and Ownership

Start state from `git status --short --branch` after the netlist-hardening
commit:

```text
## codex/phase2-netlist-hardening
```

The worktree is clean. This independent target owns only:

- `docs/adr/0026-definition-level-cell-symbol-presentation.md`
- `docs/user/project-compatibility.md`
- `apps/editor/src/document/browser-recovery-contract.test.ts`
- this plan and `plan/log.md`

Schema implementation, migration code, and production recovery behavior are
read-only. The failures reproduce on parent branch
`codex/external-subcircuit-definition`, proving they are baseline drift rather
than netlist-hardening regressions.

## Work

1. Update ADR 0026's explicit current-version note from schema 14 to schema 15.
2. Move the recovery compatibility test from the retired schema-13-to-14
   window to the active schema-14-to-15 window.
3. Align the user-facing current/previous compatibility explanation with the
   accepted schema-15/schema-14 window.

## Validation

- focused documentation and recovery tests
- `pnpm verify:branch`
- `pnpm test:impact -- --base HEAD~1`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: accepted schema-15 current shape and exactly schema 14 as the
  rolling previous recovery input.
- Primary checks: `packages/model/src/protocol-documentation.test.ts` and
  `apps/editor/src/document/browser-recovery-contract.test.ts`.

## Commit Intent

Commit as:

```text
test(protocol): align schema 15 baseline assertions
```

## Outcome

ADR 0026 and the user compatibility guide now identify schema 15 as the sole
runtime/writer shape and schema 14 as the sole rolling predecessor. The browser
recovery regression now exercises the implemented schema-14-to-15 migration
instead of the retired schema-13-to-14 window. No production schema or recovery
behavior changed.

Validation passed: focused documentation/recovery contracts (2 files / 25
tests), documentation links, test impact, diff checks, and complete
`pnpm verify:branch` (159 test files / 956 tests, all workspace builds, and
editor production preview smoke).
