---
status: completed
experience: none
---

# Net Contract N9: Acceptance Matrix Closure

## Goal

Close the remaining high-value Net-contract acceptance gap with one end-to-end
authoring regression: repeated Ground and VDD symbol placement must converge to
one canonical Net, while distinct named VDD-role supplies remain separate.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

`.worktrees/` is shared, untracked worker infrastructure and is unrelated to
this target. It will remain untouched. This target owns the focused placement
integration test and its factual planning records.

- `apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `plan/2026-08-17-net-contract-n9-acceptance-matrix/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only: `packages/model`, `packages/edit-engine`, `packages/derived`, and
the Net-contract roadmap/specifications. Shared: existing typed placement and
power-Net planner contracts.

## Work

1. Exercise four Ground and three VDD authoring operations through the public
   placement proposal and Edit Engine transaction boundary.
2. Assert canonical membership and retained AVDD/DVDD separation without
   introducing a second authoring or diagnostic pathway.
3. Record the acceptance evidence and run proportionate branch validation.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: repeated canonical power symbols merge through ordinary typed edits; role metadata does not merge distinct named supplies.
- Primary checks: placement connectivity regression and impacted test selection.

## Commit Intent

Commit as:

```text
test(net): cover repeated canonical power placement
```

## Outcome

The placement integration regression now proves four separate Ground symbols
converge to one `0` Net and three VDD symbols converge to one `VDD` Net through
ordinary placement proposals and Edit Engine transactions. AVDD and DVDD stay
as independent VDD-role Nets. Focused Vitest, test-impact, and diff checks
passed.
