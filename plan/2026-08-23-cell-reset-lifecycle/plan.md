---
status: completed
experience: none
---

# Cell reset lifecycle

## Goal

Replace the ambiguous Clear canvas operation with three explicit, previewed,
undoable Cell transitions: Clear Drawing, Reset Cell Placement, and Reset Cell
Body. Preserve the formal Cell interface across body reset and reject unsafe
Cell deletion in the pure Project planner before commit.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The dedicated worktree is clean. This target is stacked after commit
`8cb124e5`; no user or other-worker files overlap the owned set.

- `packages/edit-engine/src/cell-reset-planner.ts`
- `packages/edit-engine/src/cell-reset-planner.test.ts`
- `packages/edit-engine/src/history.test.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `packages/edit-engine/src/hierarchy-planner.ts`
- `packages/edit-engine/src/hierarchy-planner.test.ts`
- `packages/edit-engine/src/index.ts`
- `packages/agent-adapter/src/service.ts`
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `apps/mcp-server/src/resources.generated.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/hierarchy.spec.ts`
- `docs/specs/editor-interaction.md`
- `docs/specs/edit-engine.md`
- `plan/2026-08-23-cell-reset-lifecycle/plan.md`
- `plan/log.md`

Shared read-only dependencies are the model schemas, Document controller,
Project transaction executor, and current hierarchy UI. The retired Agent
adapter's exhaustive edit categorizer is owned only to mark the new
browser-editor lifecycle edits unsupported; this target does not expose an
Agent reset surface. Existing Agent/OpenAPI/MCP artifacts are regenerated from
that shared schema so they stop advertising the retired `clear_document` edit;
they are not hand-edited.

## Work

1. Add a domain-specific pure Cell reset plan with intent, source revision,
   affected IDs, diagnostics, summary, typed edits, and Document Undo receipt.
2. Implement Clear Drawing as removal of drafting and authored Route geometry
   while preserving electrical objects and semantic annotations.
3. Implement Reset Cell Placement as geometry removal plus returning placed
   Instances to the tray while preserving Instances, Nets, and formal ports.
4. Implement Reset Cell Body as an atomic edit that retains the formal
   interface and its Port markers/Nets but removes non-interface electrical and
   drawing content.
5. Replace the one Clear canvas command with explicit impact confirmations and
   browser coverage; retire the unscoped `clear_document` typed edit so no
   non-UI caller can bypass the interface-preserving policy; make Cell deletion
   caller-aware at planning time.

## Validation

- `pnpm test:local packages/edit-engine/src/cell-reset-planner.test.ts packages/edit-engine/src/transaction.test.ts packages/edit-engine/src/hierarchy-planner.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Clear Drawing|Reset Cell"`
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate-review, static contracts, and test-impact.
- Affected gates: workspace unit tests plus hierarchy and manual-editor browser
  contracts.
- Final gates: canonical `pnpm ci:check` and remote required checks before
  mainline delivery.
- Generated Agent API fixture paths are currently unclassified by the advisory
  gate, so regenerating the schema truth adds `pnpm verify:branch` to this
  target. Artifact and MCP-resource freshness checks also run explicitly.
- Risk: reset semantics cross edit validation, undo history, formal Cell
  interface invariants, and route/placement interaction. No persisted Project
  schema or generated artifact change is planned.

## Test Impact

- Decision: tests-updated
- Contracts: each reset has distinct retained/removed state; preview counts
  match the plan; all three transitions Undo; Reset Cell Body preserves formal
  terminals and remains valid when callers exist; referenced Cell deletion is
  rejected by the planner before transaction execution.
- Primary layers: edit-engine planner/transaction units and focused editor and
  hierarchy browser scenarios.

## Commit Intent

Commit as:

```text
feat(editor): add explicit cell reset lifecycle
```

## Outcome

The Edit menu now exposes three distinct Cell transactions with pure impact
plans and exact confirmation summaries. Clear Drawing retains logical content;
Reset Cell Placement retains devices/Nets/interface while returning Instances
to the tray; Reset Cell Body retains formal terminals and their marker/Net
projection even when parent callers exist. All commit through the typed Edit
Engine and restore through Document Undo. The unscoped `clear_document` edit is
retired, generated API resources reflect the replacement schema, and the
inactive Agent surface explicitly rejects the three UI lifecycle edits.

Validation passed: 61 focused planner/transaction/history/hierarchy tests;
focused reset browser behavior; all 185 unit files / 1192 tests; hierarchy
(12), project-file (10), Agent compatibility (1), and manual-editor (98)
browser suites; artifact and MCP-resource freshness; preflight; full branch
verification including build and production smoke; test-impact and diff
checks. Two initial focused browser attempts reused a different worktree's
stale Vite server; the same test passed against this worktree on an isolated
port, and all final browser gates used isolated servers.
