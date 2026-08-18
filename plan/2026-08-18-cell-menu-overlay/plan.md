---
status: completed
experience: none
---

# Cell menu overlay layout

## Goal

Make the grouped Cell command menu overlay the workspace without increasing
the hierarchy toolbar row height, while adapting the selector and menu width
to the available viewport.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-ui-polish...origin/codex/hierarchy-ui-polish
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned infrastructure and remains untouched.
This target owns hierarchy-toolbar CSS, focused browser layout coverage, and
plan/log/audit records. Cell commands, electrical behavior, and Project data
are read-only contracts.

## Work

1. Keep the closed toolbar horizontally safe, but release overflow while its
   command menu is open so the popover overlays instead of enlarging the row.
2. Let the Cell selector shrink and right-align a viewport-bounded menu.
3. Protect the overlay behavior with a browser layout assertion.

## Validation

- hierarchy Playwright layout and behavior scenarios
- direct browser inspection at desktop and narrow viewport widths
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: opening Cell commands does not change toolbar height and the
  popover remains within the viewport without changing command behavior.
- Primary checks: `apps/editor/e2e/hierarchy.spec.ts`.

## Commit Intent

```text
fix(hierarchy): overlay the adaptive Cell command menu
```

## Outcome

The hierarchy toolbar releases its scroll overflow only while a command menu
is open, so the Cell popover overlays the workspace without changing row
height. The selector now shrinks within available space and the right-aligned
popover is bounded to the viewport. No command or Cell behavior changed.

Hierarchy Playwright passed (5 scenarios), including a 420px layout assertion
that toolbar height remains fixed and the menu stays within the viewport.
Direct browser inspection confirmed a 36.67px row and a fully external,
viewport-contained popover. Test-impact, diff checks, and
`pnpm verify:branch` passed (146 unit files / 889 tests, workspace build, and
production smoke).
