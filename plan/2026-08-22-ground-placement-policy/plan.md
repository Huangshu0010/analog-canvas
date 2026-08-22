---
status: completed
experience: none
---

# Ground placement policy

## Goal

Allow an explicit Ground placement to ground an ordinary contacted Net while
retaining rejection for VDD/conflicting supply Nets and ambiguous contacts.
Use only existing named-Net, domain, and merge edits.

## State and Ownership

The branch contains the completed preceding copy-transform target, pending its
local commit. No dirty path overlaps this target. This target owns:

- `packages/edit-engine/src/power-net-planner.ts`
- `packages/edit-engine/src/power-net-planner.test.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.test.ts`

Read-only shared dependencies:

- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `packages/edit-engine/src/transaction.ts`
- Net schema and ADR 0036.

## Work

1. Treat Ground placement on an ordinary existing Net as an explicit grounding
   assertion: merge into canonical `0`, or rename/classify the contacted Net
   when no canonical ground Net exists.
2. Keep VDD placement name-first and unchanged.
3. Preserve explicit rejection for VDD/conflicting power roles and ambiguous
   contacts.
4. Add planner and placement regressions.

## Validation

- `pnpm test:local packages/edit-engine/src/power-net-planner.test.ts apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "places a Ground pin"`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: gate review, static contracts, test impact.
- Affected gates: workspace unit, component-insert browser, and hierarchy
  browser checks selected by the current planner paths.
- Final gates: `pnpm ci:check` and required remote checks before mainline
  delivery.
- Platform risks: browser placement behavior; no generated artifact change.

## Test Impact

- Decision: tests-updated
- Contracts: Ground joins a signal Net only by explicit user placement; it
  never joins a VDD-role Net.
- Primary checks: power-Net planner and component placement tests.

## Commit Intent

Commit as:

```text
fix(connectivity): make ground placement an explicit grounding action
```

## Outcome

Implemented an explicit Ground action for an ordinary contacted Net: it merges
into canonical `0` when present, otherwise names and classifies that contacted
Net as `0`. VDD and conflicting-domain contacts remain rejected. No Net schema
or VDD placement policy changed. Focused tests, static contracts, preflight,
test-impact, and the affected gate passed.
