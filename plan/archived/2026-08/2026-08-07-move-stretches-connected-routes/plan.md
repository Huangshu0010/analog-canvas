---
status: completed
experience: none
---

# Move stretches connected Routes (ADR 0009)

## Goal

Target #5 of the routing-quality sequence. Stop a device move from dragging
connected Routes into an invalid state: `move_instance` now stretches
unprotected connected Routes to keep them orthogonal, using the same
topology-preserving logic as `proposeLocalStretch`. This removes the "one move
breaks the whole transaction" failure mode that taught the Agent never to revise
placement. Bounded by ADR 0009 ("move stretches, never reroutes").

Two necessary cross-cutting fixes landed with it:

- The Agent Snapshot `topologyHash` previously hashed diagnostics, so adding
  the routing-quality metrics (target #4) changed an electrically identical
  Document's identity. Fixed to hash topology only (diagnostics are derived
  evidence, not topology).
- Phase-9 fixtures that pinned the hash or asserted `finalDiagnosticCount === 0`
  were regenerated; the `finalDiagnosticCount` gate now counts `error`
  diagnostics only (true blockers), since warnings/info are evidence, not
  blockers.

## Dirty-State Note

Owned paths do not overlap the existing editor/symbol dirty set. Phase-9
fixtures under `fixtures/agent-layout-eval/` and `fixtures/phase-9-*` were
regenerated because the topologyHash fix and #4 metrics changed their pinned
hashes; the changes are hash/count-only and are a direct consequence of #4/#5.

## Owned Files

- `docs/adr/0009-move-stretches-connected-routes.md` (new), `docs/adr/README.md`
- `packages/edit-engine/src/transaction.ts`, `routing.test.ts`
- `packages/agent-adapter/src/snapshot.ts` (topologyHash excludes diagnostics)
- `docs/specs/edit-engine.md`
- `scripts/phase-9-generalization.mjs` (count error diagnostics only)
- regenerated `fixtures/agent-layout-eval/*.json`,
  `fixtures/phase-9-generalization*`
- `plan/2026-08-07-move-stretches-connected-routes/plan.md`, `plan/log.md`

## Read-Only Files

- `packages/derived/src/stretch.ts` (proposeLocalStretch)
- `docs/adr/0007-snapshot-driven-agent-workflow.md` (topologyHash intent)
- `docs/agent/README.md` (enforcement boundary)

## Shared Dependencies

- `proposeLocalStretch` from `@icm/derived` is now called by the Edit Engine
  (it was already imported for other helpers).
- The transact `resolvedRoutes` field (target #2) now also reports
  stretch-affected Routes.

## Expected Work

Done:

1. ADR 0009 written and listed; scope is `move_instance` (Junction move deferred
   to a later target, documented).
2. `applyStretchedRoutes` helper; `move_instance` calls it. Protected adjacent
   segments are skipped (not rejected); the post-loop validation rejects if a
   skipped Route becomes non-orthogonal and the caller did not re-point it.
3. `routing.test.ts` rewritten to assert stretch success + orthogonality.
4. `topologyHash` excludes diagnostics (canonical content without the
   `diagnostics` field).
5. `finalDiagnosticCount` counts `error` only.
6. Regenerated all Phase-9 fixtures; all Phase-9 checks pass.

## Validation

- `pnpm typecheck`, `prettier --check`, 72 tests in 13 files.
- All Phase-9 checks (heldout flash/chopper/ring, skill, generalization,
  snapshot audit) pass.
- `agent-api:artifacts:check` passes.
- `git diff --check`.

## Commit Intent

```text
feat(edit-engine): stretch connected routes on instance move (ADR 0009)
```
