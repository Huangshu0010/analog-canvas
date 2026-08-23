---
status: completed
experience: none
---

# Connectivity Evidence atomic edits

## Goal

Add the minimal atomic mutation and owner-cleanup layer required before GUI Net
producers can author Connectivity Evidence. Keep current named-Net behavior
unchanged in this target; producer migration and resolved-connectivity
consumers remain separate follow-up targets.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The dedicated worktree is clean at `4d850ecf`. This target is owned by the
current worker and has no overlapping user or worker changes.

- `packages/edit-engine/src/edit-schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `packages/edit-engine/src/routing.test.ts`
- `packages/edit-engine/src/connectivity-proposal.ts`
- `packages/edit-engine/src/cell-reset-planner.ts`
- `packages/edit-engine/src/cell-reset-planner.test.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/service.test.ts`
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `apps/mcp-server/src/resources.generated.ts`
- `docs/adr/0039-connectivity-evidence.md`
- `docs/specs/edit-engine.md`
- `plan/2026-08-23-connectivity-evidence-edits/plan.md`
- `plan/log.md`

Model schema and Project migration are read-only dependencies. GUI producers,
derived connectivity, netlist export, ERC, search, highlight, and source-state
surfaces are explicitly outside this target.

## Work

1. Add `upsert_connectivity_evidence` and
   `remove_connectivity_evidence` to the typed transaction union using the
   existing schema-22 evidence shape; do not introduce a generic lifecycle
   service or another transaction protocol.
2. Enforce Document-wide object-ID uniqueness, owner/reference validity, and
   atomic rollback through the existing transaction validator.
3. When an Instance, Net Label, or other addressable power-marker owner is
   deleted through an existing typed edit, remove only evidence owned by that
   object. Retain explicit-property and SPICE-source evidence until explicitly
   removed.
4. Treat persisted evidence as Net reachability so ordinary cleanup cannot
   delete a referenced Base Net. Re-run cleanup after owner deletion so the
   final owner and its now-unreachable local Net disappear together.
   Reset Cell Body retains only evidence whose owner and every Net reference
   survive, and includes removed evidence in its impact preview.
5. Report evidence IDs and Net IDs through the existing connectivity proposal
   diff surface. Keep the retired Agent product from invoking the new edits by
   classifying them as unsupported while regenerating schema artifacts for
   protocol completeness.

## Validation

- `pnpm test:local packages/edit-engine/src/transaction.test.ts packages/agent-adapter/src/service.test.ts`
- `pnpm agent-api:artifacts:check`
- `pnpm mcp:resources:check`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate-review, static contracts, and test-impact.
- Affected gates: workspace units plus hierarchy, project-file, Agent, and
  manual-editor browser contracts selected by the stacked branch diff.
- Final gates: canonical `pnpm ci:check` and remote required checks before
  mainline delivery.
- Expected edit-schema impact selects workspace units plus hierarchy browser;
  generated Agent/MCP artifacts are refreshed because the shared typed union
  changes, not because Agent authoring is being released.
- Transaction owner cleanup is a shared mutation boundary, so focused tests
  cover accepted upsert/remove, ID collision, missing evidence, rollback,
  owner deletion, final-Net GC, and retained non-owner assertions.
- The real diff includes generated Agent request/OpenAPI and MCP resources,
  which are unclassified non-documentation paths and therefore select the full
  fallback plus branch verification. Run that advisory selection before
  completion.

## Test Impact

- Decision: tests-updated
- Primary contract: Edit Engine transaction units prove evidence mutation and
  owner lifecycle atomically; Agent adapter units prove both edit kinds remain
  unsupported to the retired Agent surface.

## Commit Intent

Commit as:

```text
feat(edit-engine): add connectivity evidence edits
```

## Outcome

The shared transaction union now has exactly two schema-22 evidence mutations:
upsert and remove. They use existing revision, validation, diff, rollback, and
Undo semantics; collide against the Document object namespace; and remain
unsupported by the retired Agent surface.

Deleting an addressable owner removes only its claim. Evidence keeps a local
Base Net reachable until its final owner/assertion is removed, after which the
ordinary cleanup path removes the unreachable Net in the same transaction.
Route split/cut/delete, Instance/Label/Junction delete, Clear Drawing, Reset
Placement, and Reset Cell Body now maintain complete evidence reference
closure and impact previews. Explicit-property, SPICE-source, and equivalence
assertions are never inferred away by owner cleanup.

Validation passed: 98 focused Edit Engine/Agent tests, generated Agent/MCP
artifact checks, preflight, hierarchy browser (12), project-file browser (10),
Agent browser (1), manual-editor browser (98), all 185 unit files / 1198 tests,
workspace build, production preview smoke, test-impact, and diff checks.
