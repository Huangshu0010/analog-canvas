---
status: active
experience: none
---

# S5 Connectivity Proposal and Wire/Net Closure

## Goal

Unify existing human connectivity producers behind one revision-bound
`ConnectivityProposal` envelope and focused planners without changing their
established Wire, move, Net Label, delete, NoConnect, preview, or Undo
behavior. Preserve `Net`/`NoConnect` as logical facts and Route/Junction as
visible geometry; the work does not infer electrical state from rendered SVG.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 5]
```

The worktree is clean after S4. This target owns the connectivity proposal
contract, the existing specialized routing/named-Net/delete/move planners and
their direct human editor adapters, plus focused test coverage. Existing
`ProjectConnectivityIndex` and resolved routing geometry are read-only shared
authorities; model schema, S1-S4 property contracts, hierarchy transaction
semantics, and existing browser gestures are compatibility dependencies.

## Work

1. Add a small immutable proposal envelope carrying source document revision,
   explicit intent, affected logical/geometry IDs, diagnostics, preview facts,
   and typed low-level edits; reject stale or mismatched proposal commits.
2. Adapt specialized Wire draw/attach, named-Net, route geometry, visual
   deletion/explicit bulk override, endpoint disconnect, selection move, and
   NoConnect planners to emit it without creating a monolithic planner.
3. Migrate the corresponding GUI/keyboard/context producers to commit only
   proposals, preserving their current status, selection, preview and one-step
   history behavior. Add only Stage-1-essential corner/vertex normalization
   where no equivalent current operation exists.
4. Characterize and verify logical/geometry deltas, stale rejection, route
   partition rules, undo/save behavior, and existing browser gesture results.

## Validation

- focused edit-engine routing/named-Net/delete/proposal tests
- focused editor Wire, move, Properties Net Label, and delete browser tests
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: one revision-bound proposal protocol, explicit logical versus
  geometry deltas, typed low-level edits, and existing GUI behavioral parity.
- Primary checks: focused planner/unit and Playwright gesture contracts.

## Commit Intent

```text
feat(connectivity): unify human editing proposals
```

## Outcome

Delivered the revision-bound `ConnectivityProposal` envelope and migrated the
human Wire, route-geometry, explicit bulk deletion, named-Net, NoConnect,
selection/copy, endpoint-disconnect, component-contact, VDD rail, and move
commit paths through it. The persisted protocol remains the existing typed
low-level edit sequence; preview, selection, status, interaction continuity,
and one-step history stay on their established paths. Added reversible
orthogonal jog creation/straightening for selected route segments, with a
planner rejection when normalization cannot create an isolated jog.

Validation passed: TypeScript typecheck; 66 focused unit/component tests;
five focused Wire/Net/NoConnect Playwright tests including the new jog path;
test-impact against `origin/main`; documentation links; and `git diff --check`.
Commit is pending: the current environment cannot create this worktree's Git
`index.lock`; the implementation and validation evidence remain in the working
tree.
