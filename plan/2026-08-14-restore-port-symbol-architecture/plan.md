---
status: active
experience: none
---

# Restore Port Symbol Architecture

## Goal

Completely reverse the unrequested conversion of visible `port` and
`port-filled` Razavi symbols into a parallel visual Port model, restoring the
pre-`74606e2` product behavior. Preserve browser Agent operation through the
same existing component/terminal contracts as human editing. Hierarchical Cell
interfaces are explicitly out of scope and are not expanded or redesigned by
this target.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns all visual first-class Port migration
and consumer paths introduced by `74606e2`, including model/schema/persistence,
edit engine, derived connectivity, renderer, GUI, Agent schema/snapshot/API,
fixtures, tests, generated API artifacts, and current docs/plan records.

Read-only authorities are the pre-migration Port symbol assets and the existing
Agent four-operation contract. The pre-existing dormant hierarchy data model is
not owned by this target; do not reintroduce a new visual Port protocol or add
Cell hierarchy behavior under another name.

## Work

1. Reverse the visual first-class Port migration at the repository level,
   resolving later Agent/RichText changes so they continue to use normal
   symbol-instance terminals.
2. Restore `port` and `port-filled` as normal reviewed Palette components and
   remove the replacement GUI and Agent semantics introduced by the migration.
3. Return fixtures, routing examples, formal render, Agent artifacts and tests
   to the symbol-based Port contract; regenerate only deterministic artifacts.
4. Prove that the Agent can place and wire existing Port symbols through the
   ordinary transaction path, with no hierarchy surface.

## Validation

- focused model, edit-engine, Agent and editor tests covering Port placement,
  wiring and snapshot/transact behavior
- generated Agent artifact check
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
revert(model): restore Port symbols as the sole Port contract
```

## Outcome

At close-out, record removed contracts, preserved Agent path and validation,
then set `status: completed`.
