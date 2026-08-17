---
status: completed
experience: none
---

# Align Ground Route Placement E2E with the Net Contract

## Goal

Repair the sole mainline-gate failure by making the route-split browser test
place Ground on an unnamed conductor, which is the valid operation the frozen
Net contract defines. Preserve its actual contract: a component terminal placed
on a Route splits the Route and maintains valid topology while moved.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/diagnostic-lifecycle...origin/codex/diagnostic-lifecycle
?? .worktrees/
```

`.worktrees/` is unrelated user/coordination state and will remain untouched.
No tracked dirty files overlap this target.

Owned paths:

- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-18-net-contract-ground-route-e2e/plan.md`
- `plan/log.md`

Read-only/shared dependencies:

- `apps/editor/src/demos/routing-demo.ts` (fixture shape)
- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `packages/edit-engine/src/power-net-planner.ts` (frozen canonical Ground
  rule: do not silently rename a differently named Net)

## Work

1. Remove only the `HORIZONTAL` name from the test-local Route Net before
   placing Ground; leave the reusable routing demo unchanged.
2. Assert that valid placement still produces the required Route split and
   contact topology, and exercise subsequent component movement.
3. Run the focused browser case, then the full pre-mainline gate.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "places a component pin onto a Route"`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Ground may claim an unnamed Route Net as canonical global `0`,
  but must reject a differently named ordinary Net; Route splitting remains
  independent of that power-name rule.
- Primary checks: the adjusted Playwright route-contact case and full
  `pnpm ci:check` pre-mainline gate.

## Commit Intent

Commit as:

```text
test(net): align ground route placement with contract
```

## Outcome

Replaced the invalid local `HORIZONTAL` Net fixture with a test-local
canonical global `0` Net. The route-contact test still proves Route splitting,
contact creation, and movement topology, without asserting that Ground may
silently rename a named ordinary Net. The focused browser scenario,
test-impact check, `git diff --check`, and complete frozen-install +
`pnpm ci:check` gate passed (143 unit files / 863 tests; 148 Playwright
scenarios).
