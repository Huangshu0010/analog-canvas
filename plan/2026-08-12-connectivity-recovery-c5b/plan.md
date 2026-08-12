---
status: completed
experience: none
---

# Connectivity recovery C5b — route deletion planner boundary

## Goal

Move route/junction deletion closure and its typed edit proposal into the
edit-engine routing planner. Preserve the current “Delete a wire; electrical
Net membership remains and flightlines express unrouted connectivity” behavior.

## State and ownership

The worktree is clean after the previous green CI. This target owns the
edit-engine routing planner/export, the editor selection compatibility adapter
and its tests, plan and log. It does not redefine `cut_connection`, renderer
flightlines, or multi-instance deletion semantics.

## Validation

Focused selection/transaction/wiring tests; workspace typecheck, Prettier and
`git diff --check`.

## Outcome

The edit-engine now owns visual route/junction deletion closure and returns the
typed transaction edits. It deliberately emits only `cut_connection` for
junctions made orphan by a cut, because the transaction owns that cleanup;
already-isolated junctions receive an explicit removal. App Delete paths now
consume the proposal, while the former editor selection helper is a thin
compatibility adapter.

Validation: workspace typecheck; 17 focused selection/wiring/transaction tests;
targeted Prettier and `git diff --check`.
