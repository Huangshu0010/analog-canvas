---
status: completed
experience: none
---

# Unified Instance Display and Reference Authoring

## Goal

Give every editor-created or imported placed Instance one consistent display
policy, expose its electrical designator separately from its schematic alias,
and ensure manually requested designators actually reach `Instance.netlist`.
This target owns display creation and authoring only; returning/deleting and
bulk placement remain later lifecycle targets.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The untracked directories are local dependency/worktree infrastructure and do
not overlap this target. Schema 16 is committed as `d70c84bc` and is a shared,
read-only dependency for this target.

Owned paths:

- `apps/editor/src/features/instance-display/`
- component insertion, import placement handoff, Properties, Instance Table,
  and focused editor tests
- narrowly necessary derived/edit-engine display tests
- this plan and `plan/log.md`

Read-only shared dependencies:

- Schema 16 annotation bindings and migration
- typed `set_instance_reference` and `set_instance_schematic_name` edits
- external-definition and internal-Cell creation planners
- structural netlist exporter/importer

## Work

1. Add one editor-owned display factory for designator, value, master, and
   formal-terminal label creation. It must be reused by manual primitive,
   internal Cell, external-subcircuit, formal-port, and imported-instance
   placement flows.
2. Make the Properties sheet expose electrical Netlist Reference separately
   from presentation-only Schematic Name. Formal Port and non-emitting marker
   views must not expose a fake reference.
3. Repair the component-insert request path so an explicit reference supplied
   by the user initializes the new Instance netlist record and passes normal
   reference-policy validation.
4. Update the Instance Table to present ID, Reference, Alias and Master as
   distinct columns/values and retain batch renumbering as the electrical
   operation.
5. Add focused contracts proving aliases never alter export facts and default
   labels never project internal IDs.

## Validation

- focused editor display, component insertion, Properties, Instance Table,
  netlist-authoring and browser interaction tests
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: category-specific default labels, explicit reference authoring,
  formal-port label semantics, table identity separation, and no-export effect
  from aliases.
- Primary checks: instance-display unit tests, component-placement tests,
  editor Properties/Table tests, and focused browser insertion/import flows.

## Commit Intent

Commit as:

```text
feat(editor): unify instance display authoring
```

## Outcome

The editor now uses one category-aware display factory: ordinary devices show a
designator/value on request, internal Cells and external calls show their
designator plus Cell/master presentation, and formal Ports show their formal
terminal name only. Component insertion now persists a user-entered reference,
Properties separates Netlist Reference from optional Schematic Alias, and the
Instance Table exposes internal ID, reference, alias and resolved master in
separate columns.

Validation passed: focused unit contracts (7 files / 25 tests), focused browser
flows (4 tests), `pnpm typecheck`, `pnpm format:check`, `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, and `git diff --check`.
Implementation committed as `0da8da3c` (`feat(editor): unify instance display
authoring`).
