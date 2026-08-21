---
status: completed
experience: none
---

# Separate Port setup from generic Insert

## Goal

Remove Port role, name, and direction controls from the generic Insert dialog.
Route `P`, Library Port choices, and an ordinary Insert selection of Port into
a dedicated compact Port Setup dialog, then retain the existing placement and
typed transaction path.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification
```

The isolated worktree is clean. Owned paths:

- `apps/editor/src/features/component-insert/`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- focused component-insert and browser insertion tests
- `docs/specs/editor-interaction.md`
- this plan and `plan/log.md`

Read-only: model, Edit Engine, Port placement planners, and project/Agent
protocols remain the existing source of truth.

## Work

1. Extend only the editor-local insert launch contract with a Port Setup
   intent and make the placement controller own its transient dialog state.
2. Add a small context-aware Port Setup dialog: top-level Free Net Port names
   are optional (`NET<n>` fallback); Cell Pin name and direction are explicit.
3. Remove Port controls from the generic Insert dialog; selecting a Port there
   opens the dedicated setup surface instead.
4. Route `P` and Library Port / Filled Port actions through the same setup
   launch, without changing the post-setup placement planner.
5. Cover compact setup and shortcut placement in unit/browser tests and record
   the UI boundary.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/insert-component-dialog.test.tsx apps/editor/src/features/component-insert/port-setup-dialog.test.tsx apps/editor/src/features/component-insert/insert-launch.test.ts apps/editor/src/features/editor-shell/shapes-panel.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep="Port shortcut starts ordinary component placement"`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: generic Insert contains no Port setup controls; every Port entry
  uses compact setup before placement; top-level free-port placement can retain
  an optional name while formal Cell Pins require their interface facts.
- Primary checks: dialog markup contracts, editor-local launch contract,
  Library structure, and the real keyboard placement workflow.

## Commit Intent

```text
refactor(editor): separate port setup from insert
```

## Outcome

Completed a compact Port Setup dialog and made it the editor-local destination
for `P`, Library Port choices, and selecting either Port from full Insert.
Generic Insert no longer contains Port role/name/direction controls. Top-level
Net names remain optional and the existing `NET<n>` fallback applies; formal
Cell Pin facts remain explicit before placement.

Validation passed: focused unit contracts (4 files / 12 tests), the real
browser `P` shortcut placement, workspace typecheck, Prettier, test-impact,
and diff checks.

Commit: `refactor(editor): separate port setup from insert` on the current
branch HEAD. Push is pending after one transient GitHub TLS handshake failure.
