---
status: active
experience: none
---

# S6 Cell and Subcircuit Interface Authoring

## Goal

Finish the Stage-1 hierarchy/netlist interface closure: one ordered formal
terminal/parameter protocol for internal Cells and external subcircuits,
focused atomic interface planners, an editor product surface, and deterministic
IR support. Preserve the existing Cell Manager, Cell Symbol Layout, Port,
caller navigation, and project transaction behavior.

## State and Ownership

`git status --short --branch` found the validated, uncommitted S5 target in
this worktree because the environment cannot create the worktree Git
`index.lock`. Those paths are a known predecessor target and do not overlap
the new S6 files except shared editor/project contracts; S6 will only extend
those contracts deliberately. Existing schema-14 model and migration already
contain formal parameter/external-definition storage, while hierarchy terminal
rename/reorder planners already exist. This target owns their missing edit,
planner, IR, validation, and GUI integration layers.

Read-only compatibility dependencies: S1-S5 properties/connectivity behavior,
existing Cell Symbol Layout, project persistence migration, renderer symbols,
and future Stage-2 printer formatting.

Shared generated-contract closure added after branch verification: the
executable typed-edit list is projected into `docs/specs/edit-engine.md`, Agent
API artifacts, and MCP resources. These are generated/internal compatibility
surfaces only; this target does not enable a public Agent release.

## Work

1. Add bounded typed edits and focused planners for formal-parameter and
   external-definition authoring, with a shared revision/impact proposal and
   no separate parameter/property bag.
2. Derive one formal interface view for internal/external targets; validate
   callers and emit complete deterministic IR where external masters are
   referenced but not emitted as empty Cells.
3. Add a Cell/Subcircuit Interface editor for terminal order/name/direction,
   formal parameters, and external definitions, reusing the existing reorder
   and Cell Symbol Layout workflows without altering their normal behavior.
4. Add focused unit/browser coverage for shared interface semantics, caller
   reconciliation, external references, validation, and atomic undo behavior.
5. Refresh the typed-edit documentation and generated internal protocol
   projections required by the changed union.

## Validation

- targeted model/edit-engine/netlist/interface editor tests
- targeted hierarchy/editor browser contracts
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: one formal interface grammar, ordered pins/parameters, external
  master references, caller reconciliation, and frozen Cell Symbol Layout.

## Commit Intent

```text
feat(hierarchy): complete formal subcircuit interfaces
```

## Outcome

Implemented one formal-interface view for internal/external targets, typed
formal-parameter and external-definition transactions/proposals, generic
external symbols, deterministic IR external masters, and the separate Cell
Interface editor. The editor reuses existing terminal reordering and does not
alter Cell Symbol Layout. Formal defaults now preserve absence distinctly from
an explicit value. A browser regression fixed asynchronous React event access
in the new parameter editor.

Validation passed: full formatting check; TypeScript typecheck; 108 focused
unit/component tests across model, transaction, hierarchy, connectivity,
netlist, symbols, and editor; focused Cell Interface Playwright workflow;
workspace build; documentation links; test-impact; and diff check. Commit is
pending because the environment cannot create this linked worktree's Git
`index.lock`.
