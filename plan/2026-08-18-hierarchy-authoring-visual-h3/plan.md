---
status: completed
experience: none
---

# Hierarchy authoring and visual H3: direct Cell Port authoring

## Goal

Make formal Cell ports quick to author without introducing a hierarchy-specific
wire, endpoint, or rendering protocol. A declared port should use the existing
component cursor-placement interaction, attach to an exact existing contact or
create one local Net in empty space, and add its formal terminal atomically.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-authoring-visual-plan...origin/codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing untracked workspace infrastructure and remains
untouched. This target owns narrow hierarchy port planners, the editor
declaration/placement/inspection surfaces, their tests, current user/spec/
roadmap guidance, and target planning records.

Read-only dependencies: schema-13 Cell presentation, terminal mutation
contracts, Project transactions, resolver-derived pin geometry, and H2 shared
placement state. No protocol revision is planned.

## Work

1. Add a one-step declared Cell Port request that reuses the pending component
   placement controller and creates an ordinary Port Instance, connection, and
   formal terminal through one Project transaction.
2. Add a compact Cell Interface surface for formal terminal name, direction,
   order, and visual side/offset editing through the existing terminal and
   Cell-symbol presentation edits; retain expose-selected-Port as an advanced
   adoption path.
3. Preserve reference-aware deletion and caller reconciliation, and cover
   exact-contact/new-Net, ordering, direction/side independence, and browser
   authoring paths.

## Validation

- focused hierarchy planner/editor/unit and Playwright regressions
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `pnpm verify:branch` before delivery

## Test Impact

- Decision: tests-updated
- Contracts: direct port authoring remains one ordinary Port/Net/formal
  interface transaction; interface presentation never changes terminal
  direction or caller electrical identities.
- Primary checks: hierarchy project transaction, component placement, Cell
  Interface rendering, and hierarchy Playwright workflows.

## Commit Intent

Commit as:

```text
feat(hierarchy): add direct Cell Port authoring
```

## Outcome

Completed direct Cell Port authoring using the shared placement interaction.
The declaration dialog selects formal name, direction, and marker; its canvas
commit adds an ordinary Port Instance, exact-contact attachment or local Net,
and formal terminal in one Project transaction. The Cell Interface table edits
direction, interface order, and definition-level side/offset independently;
the prior expose-selected-Port path remains available for advanced adoption.

Validation passed: focused App/placement/interaction Vitest (31 tests),
hierarchy Playwright (3 scenarios), `pnpm typecheck`, `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, `git diff --check`, and
`pnpm verify:branch` (144 files / 880 tests, workspace build, production
smoke).
