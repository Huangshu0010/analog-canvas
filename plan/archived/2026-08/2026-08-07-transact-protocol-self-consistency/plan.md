---
status: completed
experience: none
---

# Transact protocol self-consistency

## Goal

Target #2 of the routing-quality sequence. Close three Agent self-consistency
gaps in the `transact` path so an Agent can see the consequence of its own
operation: (1) runtime rejections localize the failing edit via
`["edits", index]` and name the offending object; (2) full diagnostics
(`objectIds`, `parameters`, `path`) are passed through instead of stripped;
(3) a successful response returns the post-normalization Route polyline for
touched Routes, so the Agent learns the actual stored geometry after
`set_route_points`/`add_junction` normalization rather than its raw input.

This is a contract change to the `transact` response (additive `resolvedRoutes`)
and the EditEngine rejection diagnostics (richer, still backward-compatible
since all added fields were already optional in the schema). It touches
`agent-api.md` spec.

## Dirty-State Note

Owned paths do not overlap the existing dirty set (editor, symbols,
fixtures, netlists). The agent-api schema fixtures (`fixtures/agent-api/*.json`)
were already dirty from prior uncommitted schema.ts work and will be regenerated
to stay in sync; they bundle pre-existing schema.ts changes not authored here,
so they are NOT staged in this commit (recorded as a follow-up hygiene step).

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/service.test.ts`
- `docs/specs/agent-api.md`
- `docs/agent/api-usage.md`
- `plan/2026-08-07-transact-protocol-self-consistency/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/derived/src/routes.ts` (routePolyline, normalizeRouteGeometry)
- `fixtures/agent-api/*.json` — regenerated to validate, NOT staged

## Shared Dependencies

- `AgentDiagnosticSchema` already permits `objectIds/path/parameters/bounds/
point`; the change is making EditEngine populate and AgentAdapter pass them.
- `AgentTransactSuccessResponseSchema` gains an optional `resolvedRoutes`;
  additive, does not break existing v2 clients.

## Expected Work

Done:

1. Extended `EditDiagnostic` with optional `objectIds` and `parameters`.
2. Extended `rejectTransaction` with optional `path` and `objectIds`; when given,
   it prefixes the path onto diagnostics and attaches objectIds; when no
   diagnostics were provided it synthesizes one carrying path/objectIds.
3. Converted the edit apply loop to an indexed `for` with a `rejectAt(code,
message, diagnostics?, objectIds?)` closure that binds `["edits", editIndex]`;
   routed all in-loop rejections through it. Pre-loop guards and post-loop
   route/document validation remain `rejectTransaction` (transaction-scoped),
   and the post-loop Route failure now carries `["routes", routeId]` and names
   the route.
4. Populated `objectIds: [edit.routeId]` on set_route_points / route_orthogonal
   rejections.
5. Stopped stripping transact-failure diagnostics in `service.ts`; pass through
   `objectIds`, `parameters`, `path`, plus `revision`.
6. Added optional `resolvedRoutes` to the success response and a
   `collectResolvedRoutes` helper that resolves touched Routes' polylines from
   the validated Document.
7. Updated `agent-api.md` and `api-usage.md` to document `resolvedRoutes` and
   edit-localized rejection diagnostics.
8. Added two focused service tests (edit-index rejection; resolvedRoutes).

## Validation

- `prettier --check` on changed TS files.
- `tsc -p` for edit-engine and agent-adapter.
- `vitest run packages/agent-adapter packages/edit-engine` (47 tests).
- `agent-api:artifacts:check` passes (artifacts regenerated, not staged).
- `git diff --check`.
- Broader typecheck/build not run by default; the change touches a shared
  contract (`transaction.ts`) so a full `pnpm typecheck` is the credible-risk
  expansion if a reviewer wants it.

## Commit Intent

```text
feat(agent-api): localize transact failures and return resolved Route geometry
```
