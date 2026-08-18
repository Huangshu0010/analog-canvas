---
status: completed
experience: none
---

# Hierarchy domain orchestration refactor

## Goal

Move reusable hierarchy construction, mutation planning, and caller summaries
out of Editor orchestration into the existing Edit Engine and Derived package
boundaries, without changing Project schema, UI behavior, or rendering.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-authoring-visual-plan...origin/codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned workspace infrastructure and remains
untouched. This target owns hierarchy planners/queries, Editor call-site
migration, focused tests, architecture guidance, and plan/log/audit records.
Generated protocol artifacts, schema 13, Symbol geometry, and unrelated UI are
read-only dependencies.

## Work

1. Move hierarchy Instance construction and Cell/Port/presentation/reorder
   orchestration into typed pure Edit Engine helpers.
2. Add one Derived caller-summary query and consume it from Cell Manager.
3. Thin Editor placement and App callbacks to input collection, planner calls,
   transaction submission, and status presentation; remove obsolete Editor
   hierarchy construction code.

## Validation

- focused Edit Engine/Derived/Editor unit and hierarchy Playwright tests
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `pnpm verify:branch` before delivery

## Test Impact

- Decision: tests-updated
- Contracts: planners emit the same ordinary Instances, Nets, terminals, and
  Project structural edits; GUI remains a thin consumer of shared semantics.
- Primary checks: hierarchy planner/query tests, rectangle conversion,
  placement/browser hierarchy workflows, and branch verification.

## Commit Intent

```text
refactor(hierarchy): centralize domain orchestration
```

## Outcome

Centralized canonical hierarchy Instance construction and Project edit planning
in `@icm/edit-engine`, added the shared Cell/caller summary to
`@icm/derived`, and reduced Editor hierarchy call sites to interaction input,
canvas geometry, planner submission, and result presentation. No Project
schema, persisted hierarchy representation, renderer, or UI behavior changed.

Validation passed: focused Vitest (5 files / 28 tests), hierarchy Playwright
(4 scenarios), typecheck, docs check, test-impact, `git diff --check`, and
`pnpm verify:branch` (146 test files / 887 tests, workspace build and
production smoke).
