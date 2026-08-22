---
status: completed
experience: none
---

# Project lifecycle closure

## Goal

Make every live-editor Project replacement use one explicit, reversible session
boundary; add a real New Project command and a bounded Previous Project action
without changing the persisted Project schema or introducing a generic
lifecycle framework.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/main
```

The dedicated worktree is clean. The repository root's untracked `.pnpm-store/`
and `.worktrees/` directories are workspace infrastructure outside this target.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/document/project-session-lifecycle.ts`
- `apps/editor/src/document/project-session-lifecycle.test.ts`
- `apps/editor/src/components/replace-guard-dialog.tsx`
- `apps/editor/e2e/project-file.spec.ts`
- `apps/editor/e2e/gallery.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-23-project-lifecycle-closure/plan.md`
- `plan/log.md`

Shared dependencies are the existing Project controller, project protocol,
browser recovery coordinator, and replacement dialog. They are read-only unless
the plan is updated before scope expansion.

## Work

1. Add a small pure Project version/transition helper covering Project-wide
   dirty detection and replacement authorization state.
2. Route Open, Import, Gallery, saved examples, recovery restore, and New
   Project through one guarded replacement entry point.
3. Retain exactly one in-memory Previous Project session across a replacement;
   keep Document Undo separate, and retain a per-session formal save baseline
   for Revert to Last Saved.
4. Add user-visible New Project, Previous Project, and Revert to Last Saved
   commands with focused unit and browser coverage.

## Validation

- `pnpm test:local apps/editor/src/document/project-session-lifecycle.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/project-file.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/gallery.spec.ts`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: `pnpm ci:static`, gate-review, and test-impact selected by the
  advisory planner.
- Affected gates: workspace unit tests, project-file browser tests, and the
  editor browser contract.
- Final gates: `pnpm ci:check` before any mainline delivery; remote required
  checks after the review branch is pushed.
- Platform risks: browser file dialogs, IndexedDB recovery, and in-memory
  Previous Project behavior require browser coverage; no generated artifacts or
  persisted schema change is planned.

## Test Impact

- Decision: tests-updated
- Contracts: Project-wide dirty detection; every live replacement is guarded;
  New Project creates canonical empty state; Previous Project restores the
  immediately replaced session without entering Document Undo; a confirmed
  save/download baseline can be restored without relying on browser recovery.
- Primary checks: `project-session-lifecycle.test.ts`, `project-file.spec.ts`,
  and `gallery.spec.ts`.

## Commit Intent

Commit as:

```text
fix(editor): close project replacement lifecycle
```

## Outcome

Every live Project replacement now crosses one explicit dirty-work guard;
browser recovery remains safety evidence rather than discard authorization.
New Project creates canonical empty state, Previous Project retains exactly one
reversible session snapshot, Revert restores the last opened or explicitly
saved/downloaded formal snapshot, and Project dirty detection observes
structure plus every Document revision. Candidate files are validated before
the destructive decision.

Validation passed: focused lifecycle unit tests (3), project-file browser tests
(10), gallery and replacement/recovery browser regressions, preflight static,
documentation, type, and test-impact checks, and the affected gate comprising
184 unit files / 1188 tests plus all 98 manual-editor scenarios. An initial
affected run exposed one recovery test that still assumed implicit replacement;
the test was updated to exercise the intentional explicit discard choice, and
the final affected run passed. `git diff --check` passed.
