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
5. Repair only the historical schema-v3 `spice.childDocumentId` migration
   required for the existing compatibility fixture to retain its already
   supported child-document link after the visual-Port rollback. This is a
   reader compatibility fix, not a new hierarchy feature or API.

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

Reverted the unrequested visual first-class Port migration and restored the
ordinary `port` / `port-filled` component and terminal contract in the GUI,
renderer, fixtures, and Agent artifacts. The Agent is covered creating a Port
through standard `add_instance`; no Port-specific Agent edit remains. Existing
document Port data remains only for legacy hierarchy rendering, without a new
visual path or API.

Remote CI exposed one related historic-reader gap: schema-v3 compatibility
fixtures stored an explicit `spice.childDocumentId` but schema-v3-to-v4 did not
carry it into the existing typed subcircuit binding. The migration now preserves
only valid explicit ids, never infers a child by name, and the fixture remains a
schema-v3 migration input. This restores the existing search-navigation test;
it does not add hierarchy authoring behavior.

Validation: `pnpm ci:static`; `pnpm test:local` (724 tests); focused migration
and imported-child search E2E; Agent artifact check and visual Golden check.

Delivery follow-up: rebase this branch onto the subsequently merged canonical
junction-node work. The preflight identifies a `plan/log.md`-only conflict;
preserve both factual entries and do not alter the unrelated connectivity code.
