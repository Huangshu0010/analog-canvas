---
status: active
experience: none
---

# Properties panel mainline regression

## Goal

Repair the stale browser assertions and the annotation-commit routing
regression discovered by canonical mainline CI after the committed Properties
panel simplification. The compact identity surface must be the tested contract,
and ordinary instance labels must continue to commit through the shared text
editing path while formal Cell Port annotations use hierarchy reconciliation.

## State and Ownership

Canonical CI found `apps/editor/e2e/component-insert.spec.ts` still requiring
the removed `.selection-overview` card and showed that the new formal-Port
annotation callback was intercepting every object-anchored instance label.
This target owns the focused Properties hook, its two browser tests, and
plan/log/audit records. The hierarchy planner and data contracts remain
read-only.

## Work

1. Assert the compact Selection shelf identity instead of the retired card.
2. Route only formal Cell Port annotations through hierarchy reconciliation;
   preserve ordinary annotation commits.
3. Re-run affected browser coverage and canonical CI before mainline delivery.
4. Preserve the complete release-contract gate while giving its remote job a
   sufficient timeout after the observed 15-minute cancellation.

## Validation

- focused component-insert and manual-editor browser tests
- `pnpm ci:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: selected component identity remains visible in the compact shelf;
  ordinary instance labels still commit; only formal Cell Port annotations
  trigger hierarchy-name projection.
- Primary checks: `apps/editor/e2e/component-insert.spec.ts`, relevant
  `apps/editor/e2e/manual-editor.spec.ts` scenarios, and
  `apps/editor/e2e/hierarchy.spec.ts`.

## Commit Intent

```text
fix(editor): preserve ordinary annotation editing
```

## Outcome

Repaired the compact Properties-browser assertions and constrained formal Cell
Port annotation reconciliation to formal Port annotations only. Ordinary
instance-label edits again use the shared canvas text-editing transaction.

The application changes passed focused six-scenario Playwright coverage and
canonical `pnpm ci:check` (146 unit files / 889 tests, build, release smoke,
and 154 browser scenarios). Remote release contracts then timed out at the
workflow's 15-minute job limit without a test failure; completion remains
pending its timeout-budget correction and green remote rerun.
