---
status: completed
experience: none
---

# Direct Cell Port authoring

## Goal

Use ordinary Port placement as the single Cell-interface authoring gesture,
automatically project formal terminals to parent Cell symbols, and remove the
redundant Cell Interface/Cell Port dialogs without changing persisted schema.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-ui-polish...origin/codex/hierarchy-ui-polish
?? .worktrees/
```

`.worktrees/` is pre-existing user-owned infrastructure and remains untouched.
This target owns Port placement orchestration, selected-Port properties and
delete dispatch, hierarchy menu/dialog cleanup, focused tests, current
hierarchy documentation, and plan/log/audit records. Project schema, stable
formal-terminal identity, caller reconciliation, and generated symbol geometry
remain shared contracts and are reused rather than replaced.

## Work

1. Route ordinary `port` and `port-filled` placement through the existing
   atomic Cell Port planner with a stable automatic name and passive default.
2. Expose formal name and direction on the selected Port's normal Properties;
   dispatch ordinary Delete through the existing safe formal-terminal removal.
3. Remove Cell Interface and Add Cell Port dialogs/menu commands while keeping
   automatic symbol generation and persisted presentation compatibility.
4. Update focused unit/browser contracts and current documentation.

## Validation

- focused hierarchy planner, placement, App, and browser tests
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: every newly placed Port is a formal terminal; parent Cell symbols
  update automatically; selected Port properties own name/direction; ordinary
  Delete preserves caller and attached-wire safety; no interface panel remains.
- Primary checks: placement/App unit tests and `apps/editor/e2e/hierarchy.spec.ts`.

## Commit Intent

```text
feat(hierarchy): derive Cell interfaces from placed Ports
```

## Outcome

Ordinary Port and Filled Port placement now commits a local Port instance, Net,
and formal Cell terminal through the existing atomic hierarchy planner. The
selected Port's normal Properties owns its formal name and direction, and the
ordinary Delete command uses the existing safe terminal-removal planner.
Removed the redundant Add Cell Port and Cell Interface dialogs and commands;
parent Cell symbols continue to derive from the same formal-terminal contract
without a schema change. Focused Vitest (4 files / 24 tests), hierarchy
Playwright (5 scenarios), docs check, test-impact, diff check, and
`pnpm verify:branch` passed (146 unit files / 889 tests, workspace build and
production smoke).
