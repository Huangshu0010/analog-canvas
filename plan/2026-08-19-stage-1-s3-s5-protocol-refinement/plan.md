---
status: completed
experience: none
---

# Refine Stage 1 S3-S5 protocols

## Goal

Refine Stage 1 S3, S4, and S5 around one Reference, instance-query/bulk-edit,
and connectivity-intent protocol while preserving the editor's current
user-visible gestures and outcomes. The roadmap must distinguish internal
protocol convergence from product behavior changes.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The dedicated worktree is clean. This documentation-only refinement continues
on the existing Stage 1 planning branch; it does not own implementation or an
accepted interaction-contract change.

Owned paths:

- `docs/roadmap/stage-1-schematic-foundation.md`
- `plan/2026-08-19-stage-1-s3-s5-protocol-refinement/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only shared dependencies:

- current Reference allocators, clipboard/hierarchy producers, Project search,
  connectivity index, routing geometry, routing planners, and editor gesture
  adapters
- accepted interaction, model, connectivity, edit-engine, and diagnostic
  contracts; later implementation must preserve their observable behavior or
  update them through a separately approved product target

## Work

1. Rewrite S3 around one Reference Policy, Index, and Planner shared by
   insertion, paste, hierarchy, Properties, numbering, and validation.
2. Rewrite S4 around one definition-level Project Instance Index and the S1/S2
   Property Field and typed-edit protocol, without a table-specific patch
   language.
3. Rewrite S5 around one Connectivity Intent Planner over the existing
   logical-Net and visible-Route authorities, with explicit behavior-
   compatibility scenarios for current GUI gestures.
4. Adjust dependency labels and factual planning records without expanding
   later Stage 1 scope.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target refines a proposed roadmap and factual records only. The
  implementation targets it defines must add characterization coverage before
  migrating each producer/consumer so current GUI gestures and outcomes remain
  unchanged.

## Commit Intent

Commit as:

```text
docs(roadmap): unify stage 1 authoring protocols
```

## Outcome

Refined S3 around one Reference Policy/Index/Planner, S4 around one
definition-level Project Instance Index and shared Batch Property Planner, and
S5 around one Connectivity Intent/Proposal protocol over the existing logical
Net and visible Route authorities. The roadmap now makes current GUI gestures
and observable results an explicit characterization boundary during internal
producer/consumer migration.

Validation passed:

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- final branch status review
