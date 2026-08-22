---
status: completed
experience: none
---

# Show Capacitor Plate Semantics in Properties

## Goal

Project the existing descriptor-owned top/bottom plate semantics for fixed and
variable capacitors into the selected Instance's Properties panel. Show each
stable Pin and its current Net as read-only electrical facts; do not introduce
an instance override, Project schema field, or free-form role editor.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 2]
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The two local commits are the completed
capacitor-semantics and Power-Rail targets requested immediately before this
target. Untracked `.pnpm-store/` and `.worktrees/` infrastructure is unrelated
and remains untouched.

Owned paths:

- a focused read-only projection helper and test under
  `apps/editor/src/features/properties/`
- the selected-Instance Properties surface in `apps/editor/src/app/App.tsx`
- focused editor/browser tests needed to prove the panel projection
- this plan and its eventual `plan/log.md` entry

Shared/read-only boundaries:

- `@icm/devices` descriptor `pinSemantics` is the semantic authority
- `Net.terminals` is the connectivity authority
- Project/Instance/Net schemas, SPICE order, Symbol geometry, and Edit Engine
  transactions remain unchanged

## Work

1. Derive ordered plate rows from the selected capacitor descriptor, stable
   Pin names, and current `Net.terminals` membership.
2. Render a read-only `Electrical terminals` Properties card for both
   `capacitor` and `variable-capacitor`, including `Unconnected` state.
3. State in the panel that plate roles are device-defined; connection changes
   continue through wiring/orientation rather than role mutation.
4. Add deterministic helper and UI regression coverage.

## Validation

- `pnpm test:local apps/editor/src/features/properties/capacitor-plate-properties.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "capacitor plate"`
- `pnpm gate:plan -- --base origin/main`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: gate-review, static contracts, and test-impact
- Affected gates: focused Properties unit coverage and editor browser coverage
- Final gates: full delivery and remote required checks before pushing main
- Platform risks: React rendering/typecheck and browser accessibility locators

## Test Impact

- Decision: tests-updated
- Contracts: fixed/variable plate rows, Pin/Net projection, unconnected state,
  and read-only Properties visibility
- Primary checks: focused helper unit test and one manual-editor browser scenario

## Commit Intent

Commit as:

```text
feat(editor): show capacitor plate terminals in Properties
```

## Outcome

Added a read-only `Electrical terminals` card for selected fixed and variable
capacitors. It presents descriptor-defined Top/Bottom plate roles, stable Pin
names, and the current named Net, unnamed Net ID, or `Unconnected` state.
Rotation and mirror are deliberately absent from the projection, and no
persisted protocol or mutation endpoint changed.

Validation passed: focused helper tests (3), focused browser regression (1),
static contracts/typecheck, full affected unit selection (179 files / 1108
tests), full editor browser selection (91 tests), test-impact, formatting, and
diff checks.
