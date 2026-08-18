---
status: completed
experience: none
---

# Test System Rationalization

## Goal

Create a maintainable, protocol-oriented test system that makes behavior
changes traceable to proportionate validation. Reduce redundant or
implementation-coupled tests only when their protected behavior is covered at
the appropriate boundary, and add focused coverage for current high-risk
cross-module contracts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## chore/test-system-rationalization
```

This is a new clean worktree created from `main`. The sibling
`chore/unify-current-protocol-baseline` worktree is user/other-worker owned and
is not modified by this target.

- `docs/testing/`
- `AGENTS.md`
- `plan/target-plan.template.md`
- `package.json`, `.github/workflows/ci.yml`, and test-support scripts when
  the audit establishes an executable governance need
- `packages/model/src/coordinate-domain.test.ts`
- `packages/derived/src/style-profile.ts` and `style-profile.test.ts`
- `packages/agent-adapter/src/snapshot.test.ts`
- `packages/netlist/src/extract.ts` and `current-contract.test.ts`
- selected test files, fixtures, and helpers identified by the audit
- `plan/2026-08-17-test-system-rationalization/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- persisted Project and Edit Engine contracts
- current protocol baseline work in the sibling worktree
- release verification unless a test-system change demonstrably requires an
  update

## Work

1. Inventory the test suite by layer, protected contract, cost, and production
   boundary. Identify explicit dead-test candidates, duplicate protection, and
   coverage gaps without treating historical negative tests as dead by name.
2. Establish a concise test-system guide and contract matrix that assigns
   current behavior to unit, module-contract, cross-module, browser, and
   release checks.
3. Require each implementation target to record test impact: tests changed or
   an explicit evidence-based reason none are needed.
4. Simplify selected oversized or redundant test coverage and add focused
   regression/contract tests for the highest-value uncovered current behavior.
5. Add deterministic checks or scripts only where they make the new rules
   enforceable without forcing meaningless test-file churn.

## Test Impact

- Decision: tests-updated
- Contracts: test-impact governance; persisted grid normalization; electrical
  topology identity; style-profile surface; case-folded netlist parameters
- Primary checks: test-impact script unit contract; model coordinate-domain;
  Agent snapshot; Derived style-profile; branch integration gate

## Validation

- `pnpm test:local <affected test paths>`
- `pnpm test:e2e:local <affected specs>` when browser behavior changes
- static/documentation or generated-artifact checks affected by final files
- `pnpm verify:branch` because governance, unit contracts, and potentially
  browser coverage cross workspace boundaries
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
test(governance): rationalize contract coverage and change discipline
```

## Outcome

Established a maintainable test-system baseline rather than a coverage target:

- added a documented layer taxonomy and current contract-ownership matrix;
- added a CI-enforced, evidence-based Test Impact declaration for implementation
  changes, without requiring meaningless test-file churn;
- removed the unreachable `portOriginRadius` style surface and its brittle
  value assertion;
- added direct contracts for persisted grid normalization and the full
  electrical-topology hash boundary; and
- aligned Netlist extraction with printer case-folding and reject ambiguous
  case-insensitive parameter duplicates.

Validation passed: focused contracts, `pnpm test:impact -- --base main`,
`pnpm ci:static`, full `pnpm test:local` (129 files / 801 tests), and
`pnpm verify:branch` (static checks, full unit suite, build, production smoke).
