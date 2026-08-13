---
status: active
experience: none
---

# Repository Tooling Consolidation

## Goal

Remove unowned historical fixtures, move optional Phase 9 research machinery
out of the daily engineering surface, and give retained golden/calibration
tools stable semantic ownership without changing product behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/local-validation-optimization...origin/codex/local-validation-optimization
```

The worktree is clean. The obsolete, clean
`codex/integration-wire-agent-main` worktree plus its local and remote branches
were removed before tracked edits. The retained capacitor calibration branch
does not share this worktree and its symbol geometry remains untouched.

- `package.json`
- orphaned text/current-arrow projects, expected migrations, and SVG goldens
- `scripts/` entries being retired or relocated
- `tools/research/phase9/`
- `tools/calibration/razavi/`
- current documentation that owns or invokes moved tools
- retired Phase 9 study documents moved under `docs/archive/`
- `plan/2026-08-13-repository-tooling-consolidation/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only and shared dependencies:

- Read-only: all product implementation under `apps/`, `packages/`, and
  `worker/`; current tests; `.github/workflows/ci.yml`; formal Razavi assets
  and their generator implementation.
- Shared: release scripts consumed by GitHub Actions, tracked golden files
  owned by current renderer tests, Agent API v2 contracts, and the accepted
  Phase 9 architecture. These remain current and must not be weakened.

## Work

1. Delete text/current-arrow fixture chains with no current code, test, doc, or
   CI consumer.
2. Move optional Phase 9 research programs under `tools/research/phase9/`,
   consolidate the three duplicated held-out fixture generators, and archive
   explicitly retired study reports.
3. Remove Phase 9 research aliases from the top-level package command surface
   and update current research documentation to direct tool invocations.
4. Rename phase-number golden entry points to stable semantic names.
5. Move Razavi manual calibration tools under `tools/calibration/razavi/`,
   document their dependencies, and remove the machine-specific output path.

## Validation

- Search for stale paths, deleted fixture identifiers, and removed package
  commands outside historical plans/logs.
- Run all retained moved tools in their deterministic `--check` or self-test
  mode where available.
- Run focused renderer, persistence/migration, Agent adapter, and SPICE corpus
  tests covering the changed fixture/tool boundaries.
- `pnpm verify:branch`
- `pnpm ci:check`
- Confirm `.github/workflows/ci.yml` and product implementation are unchanged.
- `git diff --check`
- `git status --short --branch`

The complete gate is required because package command and release-tool paths
are shared repository contracts, even though product behavior is read-only.

## Commit Intent

Commit in reviewable stages as:

```text
chore(repo): remove orphaned visual fixtures
refactor(tools): isolate phase 9 research tooling
refactor(tools): organize golden and calibration commands
```

## Outcome

Pending implementation and validation.
