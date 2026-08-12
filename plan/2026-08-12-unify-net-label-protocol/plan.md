---
status: completed
experience: none
---

# Unify Net Label binding and deletion protocol

## Goal

Make one persisted and derived meaning authoritative for a schematic Net Label:
`net-label.attachedObjectId` is the electrical Net id, while annotation
position is presentation. Deleting the annotation must leave Properties empty
even when the underlying Net retains an imported or authored name.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns the accepted Net-label contract,
shared derived resolver, editor consumption, and focused regressions.

- `docs/specs/connectivity-and-routing.md`
- `packages/derived/src/net-label.ts`
- `packages/derived/src/net-label.test.ts`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/connectivity-index.test.ts`
- `packages/derived/src/index.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `packages/agent-routing/src/types.ts`
- `packages/agent-routing/src/shapes.ts`
- `packages/agent-routing/src/expand.ts`
- `packages/agent-routing/test/expand.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-unify-net-label-protocol/plan.md`
- `plan/log.md`

Shared contracts: the existing project schema is preserved for file
compatibility; Edit Engine merge/name edits remain unchanged. The Edit Engine
will enforce Net-id binding for newly written Net Labels, and Agent routing and
all read consumers must stop supplying or interpreting another object kind.

## Work

1. Freeze Net-id binding, presentation deletion, and Net-name separation in
   the accepted connectivity specification.
2. Add one shared resolver that identifies the routed component nearest a Net
   Label using its bound Net and position.
3. Migrate legacy connectivity and the Project Connectivity Index to that
   resolver; remove Junction-id interpretation.
4. Make Route Properties read only the actual preferred Label annotation,
   never `Net.name`, and prove delete/undo/reopen behavior in the browser.
5. Enforce the binding at the Edit Engine mutation boundary and make Agent
   route expansion derive it exclusively from `RouteGraph.netId`.

## Validation

- focused derived Net-label/connectivity tests
- focused Net Label browser tests
- workspace typecheck
- targeted Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(connectivity): unify Net label binding semantics
```

## Outcome

Froze `net-label.attachedObjectId` as a Net id, added one positional resolver
for routed-component presentation, and migrated Derived connectivity, the
Connectivity Index, Agent route expansion, Edit Engine validation, and editor
Properties to that contract. Deleting a Label now removes the annotation and
leaves Properties empty across save/reopen without destructively splitting or
renaming the underlying electrical Net.

Validation completed: 45 focused Derived/Edit Engine/Agent routing tests; two
focused Net Label browser flows; workspace typecheck; targeted Prettier; and
`git diff --check`.
