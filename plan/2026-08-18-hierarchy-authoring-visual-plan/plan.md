---
status: completed
experience: none
---

# Hierarchy authoring and visual plan

## Goal

Produce a concrete, bounded implementation plan for completing schema-12
hierarchical Cell authoring interactions and Razavi-style adaptive block
presentation. The plan must reuse the current Project structure transaction,
ordinary component placement, annotation, Symbol resolver, rendering, and
style-profile contracts instead of introducing parallel protocols.

## State and Ownership

Start state from `git status --short --branch` after fast-forwarding local
`main` to `origin/main` and creating this branch:

```text
## codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing, untracked workspace infrastructure unrelated to
this documentation target. It will remain untouched. This target owns only:

- `docs/roadmap/schematic-hierarchy-authoring-and-visual-plan.md`
- `docs/roadmap/README.md`
- `plan/2026-08-18-hierarchy-authoring-visual-plan/plan.md`
- the matching factual entry in `plan/log.md`

Read-only shared dependencies include the accepted schema-12 hierarchy ADR and
specs, current model/edit/symbol/render/editor implementations, and tests named
by the proposed delivery slices. No implementation or accepted contract is
changed by this target.

## Work

1. Record the current hierarchy interaction and rendering gaps against main.
2. Define the smallest persisted symbol-presentation intent, version boundary,
   derivation rules, interaction flows, and reuse points.
3. Split implementation into bounded delivery slices with ownership,
   acceptance criteria, and focused validation.
4. Update the factual plan log and close this target.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target changes proposed roadmap and factual planning records
  only; it does not change executable behavior or an accepted normative
  contract. The roadmap names the tests required by each later implementation
  slice.

## Commit Intent

Commit as:

```text
docs(hierarchy): plan authoring and adaptive symbols
```

## Outcome

Published a proposed cross-module roadmap grounded in the merged schema-12
hierarchy implementation. It defines a schema-13 definition-level symbol
presentation intent, adaptive direction-aware geometry, shared placement and
annotation reuse, one-step formal-port authoring, caller-aware lifecycle UI,
bounded external-pin adjustment, five implementation targets, and deterministic
acceptance surfaces. Documentation links, test impact, and diff checks passed.
