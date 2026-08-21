---
status: completed
experience: none
---

# Add advisory gate planning and preflight

## Goal

Front-load validation reasoning so an Agent reviews the gates selected for a
change before running the expensive complete delivery gate. Add advisory
change-impact tooling without skipping or renaming any existing required CI
check.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .pnpm-store/
?? .worktrees/
```

`.pnpm-store/` and `.worktrees/` are unrelated user-owned local state and will
not be modified. This target owns:

- `AGENTS.md`
- `README.md`
- `package.json`
- `.github/workflows/ci.yml`
- `config/validation-gates.json`
- `scripts/check-gate-review.mjs`
- `scripts/check-test-impact.mjs`
- `scripts/gate-plan.mjs`
- `scripts/gate-run.mjs`
- `scripts/lib/validation-gates.mjs`
- `scripts/lib/validation-gates.test.mjs`
- `scripts/lib/test-impact.mjs`
- `scripts/lib/test-impact.test.mjs`
- `docs/testing/README.md`
- `docs/testing/contract-matrix.md`
- `plan/target-plan.template.md`
- `plan/2026-08-21-validation-gate-planning/plan.md`
- `plan/log.md`

Read-only shared dependencies: pnpm workspace package metadata, existing
focused Vitest/Playwright commands, current required GitHub status names, and
the other active feature worktrees. This target does not edit product code,
branch protection, or current required-check selection.

## Work

1. Add a versioned validation-gate catalog plus a conservative diff impact
   planner that explains selected gates and full-gate fallbacks.
2. Add advisory `gate:plan`, executable `gate:preflight`, and executable
   `gate:affected` commands while retaining the existing full delivery gate.
3. Require a Gate Review in implementation target plans and publish the
   advisory plan in CI without skipping existing jobs.
4. Document the new local feedback sequence and contract ownership.

## Gate Review

- Decision: full
- Early gates: validation planner unit tests, test-impact governance tests,
  `gate:plan`, `gate:preflight`, and static contracts.
- Affected gates: validation scripts plus advisory CI-plan generation.
- Final gates: existing `pnpm ci:check` and all unchanged GitHub required
  checks because this target changes gate policy and CI workflow code.
- Platform risks: workflow summary and diff-base behavior require Linux GitHub
  Actions confirmation; local execution must remain Windows-compatible.

## Validation

- Focused validation-gate and test-impact Vitest contracts.
- Advisory plan for representative documentation, editor, protocol, release,
  workflow, and unknown paths.
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `pnpm install --frozen-lockfile` and `pnpm ci:check`
- `git diff --check`
- All existing GitHub required checks before any merge.

## Test Impact

- Decision: tests-updated
- Contracts: gate selection is deterministic and conservative; implementation
  plans contain an explicit Gate Review; ordinary CI remains unchanged beyond
  publishing the advisory plan.
- Primary checks: `scripts/lib/validation-gates.test.mjs` and
  `scripts/lib/test-impact.test.mjs`.

## Commit Intent

Commit as:

```text
feat(validation): add advisory gate planning
```

## Outcome

Added a conservative, versioned gate catalog with explainable path-impact
planning, executable preflight/affected commands, target-plan Gate Review
governance, and an advisory GitHub job summary. Existing canonical CI jobs and
required-check names remain unchanged. The planner falls back to branch and
full verification for gate-policy or unknown implementation paths, ignores
local dependency/worktree directories, and executes safely on Windows and
Linux. Focused governance tests, preflight, affected branch verification, and
the canonical complete local gate all passed.
