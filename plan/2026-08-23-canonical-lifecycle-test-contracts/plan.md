---
status: completed
experience: none
---

# Canonical lifecycle browser contracts

## Goal

Align three stale full-suite browser expectations with already-accepted
Project replacement protection and schema-22 serialization, without changing
runtime behavior.

## State and Ownership

Start state from `git status --short --branch` is a dirty
`codex/project-net-lifecycle` worktree. Every existing dirty path belongs to the
active evidence-driven named-Net target; this target owns only the three
previously untouched browser specs below, so ownership does not overlap.

- `apps/editor/e2e/drafting.spec.ts`
- `apps/editor/e2e/gallery.spec.ts`
- `apps/editor/e2e/recovery-dialog.spec.ts`
- `plan/2026-08-23-canonical-lifecycle-test-contracts/plan.md`
- `plan/log.md`

Read-only shared contracts: replacement guard behavior from the completed
Project lifecycle target and current schema-22 serialization.

## Work

1. Confirm dirty Project replacement before asserting reopened drafting and
   recovery Projects.
2. Assert that a live gallery publication serializes the current Project
   schema, independent of an older gallery entry's metadata version.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts --grep "drafting content and anchor"`
- `pnpm test:e2e:local apps/editor/e2e/gallery.spec.ts --grep "Publish button posts"`
- `pnpm test:e2e:local apps/editor/e2e/recovery-dialog.spec.ts --grep "deleting one session"`
- canonical `pnpm ci:check` is rerun by the stacked branch after this test-only
  repair
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: formatting and focused browser reproduction.
- Affected gates: the three named Playwright scenarios.
- Final gates: stacked canonical `pnpm ci:check`.
- Platform risks: file-input and recovery behavior are browser-only; use an
  isolated Playwright server.

## Test Impact

- Decision: tests-updated
- Contracts: dirty replacement requires explicit confirmation; live writes use
  the current schema version.
- Primary checks: the three owned browser scenarios.

## Commit Intent

Commit as:

```text
test(editor): align canonical lifecycle contracts
```

## Outcome

Aligned the three stale full-suite expectations with the already-landed dirty
replacement guard and schema-22 serialization. All three focused browser
scenarios pass; runtime code was unchanged.
