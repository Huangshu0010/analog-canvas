---
status: completed
experience: none
---

# Tighten Stage 1 Architecture And GUI Compatibility Boundaries

## Goal

Apply the Stage 1 architecture review to the schematic-foundation roadmap: remove dual semantics, align promises with current transaction and model limits, reduce over-design, and make existing GUI behavior a default-frozen compatibility contract unless a separately justified high-benefit change is accepted.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The dedicated planning worktree is clean. This target owns only roadmap and required plan/log bookkeeping documents.

- `docs/roadmap/stage-1-schematic-foundation.md`
- `plan/2026-08-19-stage-1-architecture-review-corrections/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only contract evidence:

- `packages/model/src/schema/**`
- `packages/edit-engine/src/**`
- `packages/derived/src/**`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/testing/README.md`

Shared dependencies are the current GUI behavior, Project/Document transaction semantics, schema limits, hierarchy interface contracts, and the prior Stage 1 roadmap decisions. No implementation or test file is owned by this docs-only target.

## Work

1. Add a cross-cutting GUI compatibility gate and reconcile Reference/Value presentation with current free annotation behavior.
2. Correct transaction, bulk-edit, analyzer, non-emitting marker, ordering, naming, provenance, search-index, and parameter-limit assumptions.
3. Reduce S5/S6 planner and UI scope to focused proposals and the minimum Stage 1 exit requirements.
4. Re-audit acceptance, performance, risks, and exit language so the roadmap is implementable from the current base.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Evidence: this target changes planning documentation only; existing automated behavior is neither implemented nor altered. Documentation checks and impact analysis cover the changed surface.

## Commit Intent

Commit as:

```text
docs(roadmap): tighten stage 1 implementation boundaries
```

## Outcome

Reviewed and corrected the complete Stage 1 roadmap. The result establishes a
default-frozen GUI compatibility gate, preserves existing free instance text as
non-semantic detached presentation, aligns atomicity claims with real Project
and Document revision behavior, introduces the required bounded-bulk-edit
prerequisite, replaces duplicate preflight/export logic with one analyzer, and
removes or defers over-designed S5/S6 capabilities. It also records current
schema limits, non-emitting/external-instance prerequisites, deterministic
unplaced ordering, exact Cell-name authority, provenance-only imported terminal
mapping, focused hierarchy/connectivity planners, and dialect/PDK boundaries.

Validation passed:

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
