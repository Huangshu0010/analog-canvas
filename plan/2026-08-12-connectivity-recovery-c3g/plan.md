---
status: completed
experience: none
---

# Consume resolved routing geometry in Agent read APIs

## Goal

Move the Agent snapshot, post-transaction resolved-route payload, and region
query from the legacy per-route polyline reader to the document-level resolved
routing geometry contract, preserving their wire format and behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns the Agent read consumers only; mutation
paths in Edit Engine and geometry derivation remain read-only because they are
still legitimate lower-level users of `routePolyline()`.

- `packages/agent-adapter/src/snapshot.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/snapshot.test.ts`
- `packages/agent-adapter/src/service.test.ts`
- `plan/2026-08-12-connectivity-recovery-c3g/plan.md`
- `plan/log.md`

Shared: `packages/derived/src/resolved-route-geometry.ts` provides the public
read contract and must not change in this migration.

## Work

1. Resolve each document once at the Agent read boundary and read centerlines
   from that result.
2. Preserve snapshot and Agent response schema compatibility.
3. Add parity assertions that snapshot and post-transaction resolved routes
   retain the exact resolved centerline.

## Validation

- focused Agent snapshot/service tests
- workspace typecheck
- `git diff --check` and status

## Commit Intent

```text
refactor(agent): consume resolved route geometry
```

## Outcome

Agent snapshots, post-transaction `resolvedRoutes`, and region queries now
resolve document routing geometry once and consume its centerline. The exposed
Agent schema remains unchanged; focused parity tests assert snapshot and
transaction payloads equal the shared geometry.

Validation passed: 21 focused Agent snapshot/service tests, workspace
typecheck, targeted Prettier, and `git diff --check`.
