---
status: completed
experience: none
---

# Local Validation Optimization

## Goal

Reduce local validation resource spikes and duplicate builds while preserving
the complete canonical gate and leaving remote CI coverage unchanged.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/local-validation-optimization
```

The worktree is clean. The retained `codex/integration-wire-agent-main`
worktree only overlaps `scripts/text-annotation-wp-a0-golden.mjs`, which is
outside this target and remains untouched.

- `package.json`
- `README.md`
- `AGENTS.md`
- `plan/2026-08-13-local-validation-optimization/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only and shared dependencies:

- Read-only: `.github/workflows/ci.yml`, test files, product code, golden
  scripts, and the integration worktree.
- Shared: package-script names used by GitHub Actions. The independent
  `ci:static`, `ci:unit`, `ci:release`, and `ci:e2e` entry points must retain
  their remote behavior.

## Work

1. Add explicit low-concurrency focused and branch-level local validation
   commands.
2. Refactor the canonical local gate to build once and reuse its output while
   still running every static, unit, release, and browser check.
3. Document which command Agents should use at each validation level.
4. Refresh the completed-plan queue for machine-readable plans integrated on
   current `main`.

## Validation

- `pnpm test:local <representative unit test>`
- `pnpm test:e2e:local <representative browser test>`
- `pnpm verify:branch`
- `pnpm ci:check`
- Confirm `.github/workflows/ci.yml` remains unchanged.
- `git diff --check`
- `git status --short --branch`

The canonical gate is run once because this target changes that gate itself.
Remote CI commands remain independent and unchanged.

## Commit Intent

Commit as:

```text
chore(test): reduce local validation resource usage
```

## Outcome

Added low-concurrency local unit and browser commands plus a branch integration
tier. The canonical local gate still runs every static, unit, release, and
browser check, but now performs one workspace build instead of three and caps
local test workers. GitHub Actions retains its independent job and browser
shard commands unchanged. Focused unit/browser checks, `pnpm verify:branch`,
and `pnpm ci:check` all passed; the complete gate covered 675 unit tests and 96
browser scenarios.
