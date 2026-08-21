---
status: completed
experience: none
---

# Placement Tray UI

## Goal

Turn retained, unplaced Instances into a clear editor workflow: legible tray
entries, explicit return-to-tray versus permanent delete, individual placement
entry, and deterministic place-all / return-all actions. This target consumes
the completed lifecycle engine; it does not add a second lifecycle protocol.

## State and Ownership

Start state: `codex/schematic-instance-lifecycle-ux` at `c2295d6e`, with only
untracked local `.pnpm-store/` and `.worktrees/` infrastructure. Those paths
are unrelated and will remain untouched.

Owned paths:

- placement-tray pure planner and tests
- `apps/editor/src/app/App.tsx` tray, selection action, and bulk transactions
- focused browser/unit contracts and current interaction/user documentation
- this plan and `plan/log.md`

Shared read-only dependencies: schema-16 identity bindings, edit-engine
`unplace_instance` and lifecycle planners, formal-Port hierarchy protection,
canvas viewbox, and existing selection deletion adapter.

## Work

1. Add a small deterministic editor placement planner for bulk layout within
   the current canvas view. It emits only ordinary `place_instance` edits and
   avoids duplicating engine semantics.
2. Replace the bare unplaced button list with a Placement Tray that shows the
   semantic display identity, supports one-item drag/drop and keyboard/click
   placement entry, and exposes Place all.
3. Add a selected-instance **Return to tray** action and **Return all** action;
   both use the shared unplacement planner. Keep Delete permanent and visibly
   distinct, preserving existing formal-Port safeguards.
4. Add targeted tests and document the three-state lifecycle and bulk-layout
   policy.

## Validation

- placement planner / transaction / selection focused unit tests
- focused browser coverage for tray actions
- `pnpm typecheck`, `pnpm format:check`, `pnpm docs:check`, and
  `pnpm test:impact -- --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: bulk placement is deterministic and emits only placement edits;
  Return retains electrical facts; permanent Delete remains separate; formal
  Cell Ports retain existing hierarchy protection.
- Primary checks: tray planner unit tests and editor browser interaction.

## Commit Intent

```text
feat(editor): add placement tray controls
```

## Outcome

Added the Placement Tray as the retained-unplaced lifecycle surface. Tray rows
now expose semantic identity plus drag and cursor-placement entry; `Place all`
emits deterministic ordinary placement edits. Selected non-Port Instances can
return to the tray, while `Return all` deliberately excludes formal Cell Ports
and permanent Delete remains unchanged. The existing component-placement state
now also handles a retained Instance so orientation and Esc behavior stay
uniform.

Validation passed: focused placement/interaction/connectivity/lifecycle unit
tests (4 files, 24 tests), focused Placement Tray browser regression, workspace
typecheck, format, docs, test-impact, diff checks, and complete
`pnpm verify:branch` (static contracts, workspace unit suite, build, and
production smoke). Test-impact reported one harmless warning while scanning the intentionally untouched local
`.pnpm-store/` directory. Commit evidence follows this plan update.
