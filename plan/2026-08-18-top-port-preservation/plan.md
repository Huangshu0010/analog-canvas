---
status: completed
experience: none
---

# Preserve top-level Port behavior

## Goal

Limit automatic Cell-interface creation to reusable child Cells so a Port in
the top-level schematic remains an ordinary electrical component and preserves
its existing deletion behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-ui-polish...origin/codex/hierarchy-ui-polish
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned infrastructure and remains untouched.
This target owns the component-placement condition, the existing top-level
Port browser regression, target records, and their factual log/audit entries.
The Cell terminal planner and persisted project schema are shared contracts and
will be reused unchanged.

## Work

1. Apply automatic formal-terminal authoring only when placement is inside a
   non-top-level Cell.
2. Retain top-level Port placement and ordinary deletion as covered by the
   existing editor browser contract.
3. Record the clarified top-level boundary in current hierarchy documentation.

## Validation

- focused component-placement and manual-editor browser checks
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: child Cell Ports define formal terminals; top-level Ports remain
  ordinary electrical components.
- Primary checks: `apps/editor/e2e/hierarchy.spec.ts` and
  `apps/editor/e2e/manual-editor.spec.ts`.

## Commit Intent

```text
fix(hierarchy): preserve top-level Port behavior
```

## Outcome

Automatic formal-terminal authoring is now limited to non-top-level Cell
documents. Top-level hollow and filled Ports retain their ordinary component
placement, wiring, move, and Delete behavior. The existing browser regression
was run together with the child-Cell automatic-interface scenario; both passed,
as did typecheck, docs check, and diff check. Canonical mainline CI will be run
from the resulting commit before `main` is updated.
