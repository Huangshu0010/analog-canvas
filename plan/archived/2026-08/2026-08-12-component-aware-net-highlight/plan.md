---
status: completed
experience: none
---

# Make Net highlight consume routed-component connectivity

## Goal

Make highlight a pure consumer of the Connectivity Index's routed-component
API. A selected Route, endpoint, or Net Label supplies only an origin; removing
a Label must immediately split the highlighted visible component even when a
historic same-name merge left both components under one persisted Net id.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns routed-component membership exposed by
Derived, the Net highlight consumer, the editor's typed highlight origin,
focused regressions, this plan, and the maintenance log.

- `packages/derived/src/connectivity.ts`
- `packages/derived/src/net-highlight.ts`
- `packages/derived/src/net-highlight.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/specs/connectivity-and-routing.md`
- `plan/2026-08-12-component-aware-net-highlight/plan.md`
- `plan/log.md`

Shared dependencies: `resolveNetLabelBinding()` remains the only Label-to-Net
adapter; `ProjectConnectivityIndex` remains the single read model. Persisted
Net membership and the accepted Label delete semantics are not mutated here.

## Work

1. Include Route ids in each Derived routed component and let Net highlight
   accept an optional endpoint origin.
2. Aggregate only the component containing that endpoint; keep the unseeded
   whole-Net form for hierarchy/search callers that lack a visible origin.
3. Store a typed endpoint origin in editor highlight state for Route, endpoint,
   and valid Net Label selection; feed `H` and visible actions through it.
4. Prove that same-label disconnected routes highlight together before Label
   deletion and separately after deletion, including the GUI flow.
5. Freeze the distinction between persisted Net membership and the seeded
   visible routed component consumed by highlight.

## Validation

- focused Derived Net highlight tests
- focused Net highlight browser tests
- workspace typecheck
- targeted Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(connectivity): highlight routed components through the index
```

## Outcome

Added Route membership to the Connectivity Index's routed components and made
Net highlight accept a typed endpoint origin. The editor now stores only that
origin, while Derived resolves the exact visible component and returns the ids
the renderer paints. Removing a Label rebuilds the virtual connectivity and
immediately separates highlights despite a historic shared persisted Net id.

Validation completed: 24 focused Derived connectivity/index/highlight tests;
four focused browser flows including the two-components/delete-Label case;
workspace typecheck; targeted Prettier; and `git diff --check`.
