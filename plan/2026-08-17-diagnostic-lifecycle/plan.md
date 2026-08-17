---
status: completed
experience: none
---

# Separate Live Diagnostics from Operation Reports

## Goal

Make the editor's diagnostic lifecycle truthful and low-noise: current ERC,
routing, and visual findings are derived only from the current Project and
disappear when their condition is resolved, while SPICE import messages remain
an explicitly historical import report that is excluded from current
diagnostic counts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/diagnostic-lifecycle
?? .worktrees/
```

The branch starts from the completed Net-contract branch. `.worktrees/` is an
unrelated untracked coordination directory and will remain untouched. No
tracked dirty paths overlap this target.

Owned paths:

- `packages/derived/src/diagnostics/diagnostic.ts`
- `packages/derived/src/diagnostics/diagnostic.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.tsx`
- `apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `apps/editor/src/document/document-controller.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`（仅诊断面板场景）
- `docs/adr/0015-object-locator-and-diagnostic-envelope.md`
- focused editor lifecycle tests if the React wiring cannot be proved at the
  existing component/module layer
- this target plan and `plan/log.md`

Read-only/shared dependencies:

- `packages/model` Project/Document revision and Net contracts
- `packages/derived/src/visual.ts` producer policy; this target does not retune
  individual visual rules
- `packages/spice` import diagnostic protocol; import messages remain intact
- `apps/editor/src/document/document-controller.ts` transaction lifecycle;
  edit only if a test proves successful commits do not publish a fresh snapshot

## Work

1. Define a revision-stamped live diagnostic snapshot and explicit diagnostic
   visibility classification without persisting diagnostics in the Project.
2. Keep SPICE diagnostics in a separately named import report and ensure they
   are never counted or presented as current schematic failures.
3. Use one Project-wide live diagnostic surface; remove duplicate current
   Visual diagnostics from Import Review.
4. Default the workbench to actionable/gate-eligible findings while retaining
   an explicit control for non-blocking observations.
5. Add lifecycle regressions covering resolve, undo/redo-derived recurrence,
   project replacement/import-report separation, and duplicate-free UI output
   at the cheapest deterministic layer.
6. Amend the accepted diagnostic envelope ADR with the live-snapshot versus
   operation-report lifecycle boundary.

## Validation

- `pnpm test:local packages/derived/src/diagnostics/diagnostic.test.ts apps/editor/src/features/selection/selection-inspector-details.test.tsx`
- `pnpm test:local apps/editor/src/document/document-controller.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "diagnostic"`
- any additional focused lifecycle test added by this target
- `pnpm test:impact -- --base codex/net-contract-unification-plan`
- `git diff --check`
- `git status --short --branch`

This target crosses Derived and Editor presentation contracts, so focused
package tests are primary; expand to `pnpm verify:branch` before delivery if the
final diff changes App transaction or project-replacement wiring.

## Test Impact

- Decision: tests-updated
- Contracts: live diagnostics are revision-stamped current evidence; resolved
  findings disappear and recur under undo; import reports are historical and
  excluded from live counts; visual observations remain available without
  being the default actionable view
- Primary checks: `packages/derived/src/diagnostics/diagnostic.test.ts`,
  `apps/editor/src/features/selection/selection-inspector-details.test.tsx`,
  `apps/editor/src/document/document-controller.test.ts`, diagnostic-focused
  cases in `apps/editor/e2e/manual-editor.spec.ts`

## Commit Intent

Commit as:

```text
refactor(diagnostics): separate live findings from import reports
```

## Outcome

Delivered a revision-stamped live diagnostic snapshot, one Project-wide current
diagnostic surface, explicit separation of historical SPICE import reports,
and default suppression of non-gating visual/routing observations. Current ERC
findings now have deterministic resolve/undo/redo browser coverage; Project
replacement clears the prior import report. Focused unit and diagnostic E2E
checks, test-impact, `git diff --check`, and `pnpm verify:branch` passed.
