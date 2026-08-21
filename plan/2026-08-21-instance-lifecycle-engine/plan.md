---
status: completed
experience: none
---

# Instance Placement Lifecycle Engine

## Goal

Make the retained-unplaced / placed / deleted Instance lifecycle explicit and
safe at the edit-engine boundary. Add `unplace_instance`; consolidate route
endpoint replacement and destructive cleanup so NoConnect no longer blocks a
connected-instance delete.

## State and Ownership

Start state: branch `codex/schematic-instance-lifecycle-ux` contains completed
Schema 16 and display-authoring targets. The only untracked paths remain local
`.pnpm-store/` and `.worktrees/` infrastructure and will not be changed.

Owned paths:

- `packages/edit-engine/src/{edit-schema,transaction,instance-lifecycle}*`
- selection deletion adapter and focused unit tests
- protocol-category consumer and generated MCP resource schema required by the
  shared edit union
- current edit/model documentation, this plan and `plan/log.md`

Shared read-only dependencies: Schema 16, Route/Junction geometry, NoConnect
invariants, DocumentHistory, hierarchy formal-port wrappers, and editor
selection UI.

## Work

1. Add `unplace_instance` to the single typed edit union; it changes only a
   placed Instance to `placement: null` and preserves electrical facts.
2. Move connected-instance route detachment into an edit-engine lifecycle
   planner. It replaces routed terminal endpoints with Junctions at resolved
   pin positions before unplace/delete.
3. Implement delete composition that detaches routes, removes terminal
   memberships, removes NoConnects and instance-anchored annotations, then
   performs strict `remove_instance`.
4. Make the editor selection deletion flow consume the shared planner, without
   changing formal-port hierarchy protection. Keep the protocol consumer's
   edit category and generated schema synchronized; this is contract hygiene,
   not new Agent behavior.

## Validation

- focused edit-schema, transaction/lifecycle and selection-deletion tests
- `pnpm typecheck`, `pnpm format:check`, `pnpm test:impact -- --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: unplace preserves netlist/electrical membership; delete clears
  NoConnect and annotations; routed pins become stable Junction endpoints;
  all lifecycle edits remain atomic.
- Primary checks: edit-engine transaction/lifecycle tests and editor selection
  deletion tests.

## Commit Intent

```text
feat(edit-engine): add instance placement lifecycle
```

## Outcome

Implemented `unplace_instance` and the shared lifecycle planner. Returning an
Instance to the tray now detaches routed terminals to resolved Junctions while
retaining net membership, NoConnects, annotations, binding, and parameters.
Deletion reuses the same detachment and then clears terminal membership,
NoConnects, instance-owned annotations, and unlocked layout references before
strict removal. The editor selection adapter now delegates to this engine
planner; the retired Agent surface parses but does not advertise or execute the
new browser-only lifecycle edit.

Validation passed: focused lifecycle/transaction/protocol/selection/Agent
tests (5 files, 56 tests), `pnpm typecheck`, `pnpm format:check`,
`pnpm docs:check`, `pnpm mcp:resources:check`,
`pnpm test:impact -- --base origin/main`, and `git diff --check`. Test-impact
reported one harmless warning while scanning the intentionally untouched local
`.pnpm-store/` directory. Commit evidence follows this plan update.
