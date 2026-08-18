---
status: completed
experience: none
---

# Hierarchy UI and visual polish

## Goal

Clarify root-versus-child Cell authoring, simplify the hierarchy toolbar,
display one Cell-name label per hierarchy instance, and bring hierarchical
block pin text and body closure into the Razavi presentation path.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

`main` was current before creating `codex/hierarchy-ui-polish`.
`.worktrees/` is pre-existing user-owned workspace infrastructure and remains
untouched. This target owns hierarchy UI components/styles, Cell placement
annotations, hierarchical Symbol/render presentation, focused tests, current
user/interaction documentation, and plan/log/audit records. Project schema,
electrical reference identity, connectivity, and unrelated editor surfaces are
read-only contracts.

## Work

1. Hide Cell interface authoring for the root Document and group non-navigation
   hierarchy commands under one toolbar menu.
2. Replace the expanded toolbar interface table with a bounded dialog.
3. Keep the internal `Xn` subcircuit reference while showing only the Cell name
   at the former reference-label position.
4. Render hierarchical pin names through Razavi rich text and close the block
   body with a true polygon.

## Validation

- focused hierarchy placement, Symbol, render, and editor tests
- hierarchy Playwright workflows
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: root Cell has no interface-authoring controls; hierarchy callers
  show one Cell-name label at the reference slot; hierarchical body and pin
  typography use the shared Razavi renderer; all commands remain reachable.
- Primary checks: hierarchy Symbol/render unit tests, placement tests, and
  `apps/editor/e2e/hierarchy.spec.ts`.

## Commit Intent

```text
fix(hierarchy): refine Cell authoring UI and visuals
```

## Outcome

The root Cell no longer exposes reusable-symbol interface authoring. Hierarchy
commands are grouped under one Cell menu, while the full child-Cell interface
editor lives in a bounded dialog. Hierarchy instances retain their internal
`Xn` identity but show only the Razavi Cell-name annotation at the former
reference slot. Pin names now use shared Razavi rich text, and the adaptive
body is a truly closed polygon.

Focused Vitest passed (4 files / 24 tests), hierarchy Playwright passed (4
scenarios), and documentation, typecheck, test-impact, diff checks, and
`pnpm verify:branch` passed (146 unit files / 888 tests, workspace build, and
production smoke).
