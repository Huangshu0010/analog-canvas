---
status: completed
experience: none
---

# Hierarchy UI behavior-preservation correction

## Goal

Keep every existing Cell interface action reachable while retaining the new
grouped layout, and scope Razavi pin typography strictly to derived
hierarchical blocks.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-ui-polish...origin/codex/hierarchy-ui-polish
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned infrastructure and remains untouched.
This correction owns the hierarchy menu/dialog visibility contract, the
hierarchical pin renderer branch, focused tests, and plan/log/audit records.
Cell electrical data, Project schema, and unrelated symbol rendering remain
read-only contracts.

## Work

1. Restore Cell Interface access for the top Document so layout changes do not
   remove any existing Port operation.
2. Keep Add/Expose/Rename/Delete behavior inside the grouped interface dialog.
3. Apply Razavi pin RichText only when the resolved Symbol is a hierarchical
   block; retain the prior plain-pin renderer for every other Symbol.

## Validation

- focused App, hierarchy render, and browser tests
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: layout grouping does not remove top-level interface actions;
  non-hierarchical visible pin names retain their prior rendering.

## Commit Intent

```text
fix(hierarchy): preserve interface behavior in grouped UI
```

## Outcome

The grouped hierarchy layout now preserves Cell Interface access for every
active Document, including the top Cell. Add, expose, rename, delete,
direction, order, and pin-placement operations remain reachable through the
dialog. Shared visible-pin rendering retains its prior plain-text behavior;
Razavi RichText is selected only for derived hierarchical blocks.

Focused Vitest passed (2 files / 18 tests), hierarchy Playwright passed (4
scenarios), and test-impact, diff checks, and `pnpm verify:branch` passed (146
unit files / 889 tests, workspace build, and production smoke).
