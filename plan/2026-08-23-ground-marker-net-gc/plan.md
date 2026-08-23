---
status: completed
experience: none
---

# Reclaim Empty Power-Marker Nets

## Goal

Make standalone Ground/VDD placement fully repeatable: deleting the final
marker must release its owner evidence, empty Base Net, and now-unreachable MOS
bulk-default reference so placing the same generated instance ID succeeds.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle [ahead 25]
```

The worktree is clean. This target owns:

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `plan/2026-08-23-ground-marker-net-gc/plan.md`
- `plan/log.md`

Shared contract: owner-addressed power-marker evidence and MOS bulk-default
lifecycle. Read-only GUI placement/deletion planners establish the reproducer.

## Work

1. Reproduce the stale `net-power-gnd1` lifecycle at the transaction boundary.
2. Clear a bulk-default reference when it is the only remaining reason an
   otherwise unreachable Base Net survives garbage collection.
3. Protect delete-and-replace behavior with a focused regression test.

## Validation

- `pnpm test:local packages/edit-engine/src/transaction.test.ts`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: advisory `gate:plan` selected static contracts and test impact.
- Affected gates: focused Edit Engine transaction tests, followed by the real-diff affected plan.
- Final gates: branch delivery remains subject to the repository mainline gate; this bounded fix is not being delivered to `main` in this target.
- Platform risks: none beyond deterministic TypeScript lifecycle behavior.

## Test Impact

- Decision: tests-updated
- Contracts: deleting the final standalone Ground/VDD owner removes its empty
  power Net and stale cell bulk default; the released generated IDs can be
  reused immediately.
- Primary checks: `packages/edit-engine/src/transaction.test.ts`.

## Commit Intent

Commit as:

```text
fix(connectivity): reclaim deleted power marker nets
```

## Outcome

Deleting a standalone Ground/VDD marker now removes an otherwise unreachable
power Base Net even when that Net was the cell MOS bulk default. Garbage
collection clears the corresponding default reference first, preserves any
other default, and still retains Nets with materialized MOS bindings or other
durable owners. A regression deletes and immediately recreates `GND1` with
`net-power-gnd1`.

Validation completed: focused transaction tests (46), full affected unit tests
(187 files / 1215 tests), hierarchy browser tests (13), static contracts,
test-impact, formatting, typecheck, and diff check.
