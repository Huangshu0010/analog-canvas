---
status: completed
experience: none
---

# Fix MOS Copy Transition and VDD Rail Presentation

## Goal

Eliminate the remaining rapid `I`-placement to `C` failure for NMOS/PMOS by
fixing the underlying placement/selection/derived-connectivity transition, not
by adding key-specific guards. Correct the committed and preview VDD Rail
presentation so it is a single thick rail with no thin terminal stub and a
bold italic `V_DD` label.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean at merge commit `f346695`; this target starts on the
isolated branch `codex/mos-copy-vdd-visual-fix`. It owns the editor placement
transition, MOS placement regressions, VDD Rail preview/renderer presentation,
and directly related tests and interaction documentation.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/**`
- `apps/editor/src/features/component-insert/**`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/render-svg/src/**`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-14-mos-copy-vdd-visual-fix/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Shared read-only dependencies include the model MOS supply binding contract.
The Edit Engine transaction authoring path is owned only for the VDD label AST;
MOS supply and connectivity semantics remain read-only.

## Work

1. Reproduce rapid `I -> place NMOS/PMOS -> C` and compare it with passive
   components, including selection, revision, supply-default reconciliation,
   placement continuation, preview teardown, and copy clipboard construction.
2. Make placement completion and command transition atomic for every component
   class. No delayed MOS-specific mutation or stale selection may outlive the
   committed transaction; configured shortcut keys remain unchanged.
3. Remove the thin end stub from both VDD Rail preview and committed rendering.
   Render the complete `V_DD` label in bold italic mathematical styling while
   keeping it separate from electrical geometry and hit testing.
4. Add focused reducer/browser regressions for NMOS, PMOS, and a passive
   control, plus VDD geometry and text-style assertions.
5. Update the accepted interaction specification if the placement completion
   contract changes.

## Validation

- Focused interaction/component/VDD/render unit tests.
- Focused browser tests for rapid MOS placement-to-copy and VDD appearance.
- `pnpm typecheck`
- `pnpm verify:branch` if the fix crosses editor and renderer boundaries.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): stabilize MOS copy transition and VDD rail
```

## Outcome

Reproduced the remaining rapid-command failure as a render-publication race:
React could receive `Escape` and `C` before publishing the first reducer
transition, so the keyboard handler read a stale placement mode. MOS placement
made the vulnerable interval more visible because its commit also reconciles a
bulk supply default. The interaction hook now advances a synchronous current
state through the same reducer before queueing React publication, and every
command boundary reads that current value. A related unsafe assumption in
`isTypingTarget()` was also removed so keyboard events targeting Window or
Document cannot throw and blank the application.

VDD Rail now renders only its thick `power-rail` Route. The redundant
annotation-owned thin `supply-bar` was removed, and newly authored VDD labels
persist one nested RichText span that keeps both `V` and subscript `DD` bold
italic. Live browser inspection confirmed zero supply bars, one 3.24-width
route, and italic/700 weight on both text portions.

Validation completed:

- 31 focused interaction, VDD, and renderer unit tests passed.
- The focused rapid NMOS/PMOS/passive `Escape -> C` and VDD browser tests
  passed (2/2); the full component-insert browser suite passed (15/15).
- `pnpm verify:branch` passed: formatting/docs/reference checks, typecheck, 102
  unit-test files / 558 tests, every workspace build, and production smoke.
- `git diff --check` passed before completion metadata and is repeated at
  handoff.
