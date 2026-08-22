---
status: completed
experience: none
---

# Unify copy-placement transforms

## Goal

Make Copy Placement preview and commit use the same ordered transform plan so
secondary rotation/mirror commands preserve instance, route, junction, and
annotation geometry without adding a persisted clipboard or text-layout
protocol.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-transform-power-bulk...origin/main
```

The worktree is clean. This target owns only the copy-placement planner,
selection integration, managed Port/VDD label following as needed by that
planner, and their adjacent tests.

- `apps/editor/src/features/clipboard/clipboard.ts`
- `apps/editor/src/features/clipboard/clipboard.test.ts`
- `apps/editor/src/features/selection/use-selection-interaction.ts`
- `apps/editor/src/features/selection/use-selection-interaction.test.ts`
- `packages/edit-engine/src/transaction-instance-annotations.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/hierarchy.spec.ts`

Read-only shared dependencies:

- `packages/edit-engine/src/transaction.ts` is the sole committed transform
  path.
- `packages/model/src/geometry.ts` defines orientation composition.
- Annotation and edit schemas remain unchanged.

## Work

1. Derive preview and commit from one ordered copy-placement transform plan.
2. Transform copied graph geometry around one anchor while delegating
   object-anchored annotations to the existing Edit Engine following layer.
3. Route canonical Port and VDD labels through the same managed upright-label
   handling without changing their persisted annotation shape.
4. Add focused regressions for ordered secondary transforms and preview/commit
   equivalence.

## Validation

- `pnpm test:local apps/editor/src/features/clipboard/clipboard.test.ts apps/editor/src/features/selection/use-selection-interaction.test.ts packages/edit-engine/src/transaction-instance-annotations.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "copy|rotate|mirror"`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: gate review, static contracts, test impact.
- Affected gates: workspace unit plus editor and hierarchy browser selections;
  component insertion is not changed in this target.
- Final gates: `pnpm ci:check` and required remote checks before mainline
  delivery.
- Platform risks: browser-only copy interaction and generated artifacts are
  not expected to change.

## Test Impact

- Decision: tests-updated
- Contracts: preview and commit consume identical ordered transform intent;
  managed labels do not drift or overlap after copy secondary transforms.
- Primary checks: adjacent clipboard/selection/Edit Engine unit tests and one
  focused manual-editor workflow.

## Commit Intent

Commit as:

```text
fix(editor): unify copy placement transforms
```

## Outcome

The initial ordered-operation work is committed as `a4961302`. The follow-up
reflows canonical free-Port Net labels through the same upright reference
placement after a normal or copied orientation edit, and makes a partial
formal-Port ghost omit irrelevant Cell-interface metadata. Focused tests,
static contracts, preflight, test-impact, and the affected gate passed.
